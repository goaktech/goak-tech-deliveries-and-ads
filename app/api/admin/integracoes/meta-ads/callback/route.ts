import { NextResponse } from 'next/server';
import { concluirConexaoMetaAds, validarStateMetaAds } from '@/utils/meta-ads';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json({ error: 'Callback do Meta Ads inválido.' }, { status: 400 });
  }

  try {
    const payload = validarStateMetaAds(state);
    if (!payload.restauranteId) {
      throw new Error('State OAuth sem restaurante vinculado.');
    }

    await concluirConexaoMetaAds(code, payload.restauranteId);

    const redirectUrl = new URL('/admin/pagamentos', request.url);
    redirectUrl.searchParams.set('status', 'meta-ads-conectado');
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao concluir conexão do Meta Ads.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
