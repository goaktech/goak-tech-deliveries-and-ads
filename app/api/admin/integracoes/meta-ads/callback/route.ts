import { NextResponse } from 'next/server';
import { concluirConexaoMetaAds, motivoErroConexaoMetaAds, validarStateMetaAds } from '@/utils/meta-ads';
import { COOKIE_NONCE_META_ADS } from '@/utils/meta-ads-oauth';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';

function redirecionar(request: Request, status: string, motivo?: string) {
  const url = new URL('/admin/integracoes', request.url);
  url.searchParams.set('status', status);
  if (motivo) {
    url.searchParams.set('motivo', motivo);
  }
  const resposta = NextResponse.redirect(url);
  resposta.cookies.delete({ name: COOKIE_NONCE_META_ADS, path: '/api/admin/integracoes/meta-ads' });
  return resposta;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // O usuário clicou em "Cancelar" (ou negou as permissões) na tela da Meta.
  if (url.searchParams.get('error')) {
    return redirecionar(request, 'meta-ads-cancelado');
  }

  if (!code || !state) {
    return redirecionar(request, 'meta-ads-erro', 'estado-invalido');
  }

  try {
    const payload = validarStateMetaAds(state);

    const cookieHeader = request.headers.get('cookie') ?? '';
    const nonceCookie = cookieHeader
      .split(';')
      .map((parte) => parte.trim().split('='))
      .find(([nome]) => nome === COOKIE_NONCE_META_ADS)?.[1];
    if (!nonceCookie || nonceCookie !== payload.nonce) {
      throw new Error('State OAuth do Meta Ads sem nonce correspondente.');
    }

    // Quem volta do OAuth tem que ser o mesmo gestor (e restaurante) que iniciou a conexão.
    const restauranteDoGestor = await obterRestauranteIdDoGestorLogado();
    if (restauranteDoGestor !== payload.restauranteId) {
      throw new Error('State OAuth de outra sessão.');
    }

    await concluirConexaoMetaAds(code, payload.restauranteId);
    return redirecionar(request, 'meta-ads-conectado');
  } catch (error) {
    console.error('[meta-ads] Falha ao concluir conexão:', error);
    return redirecionar(request, 'meta-ads-erro', motivoErroConexaoMetaAds(error));
  }
}
