import { NextResponse } from 'next/server';
import { desconectarMetaAds } from '@/utils/meta-ads';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';

export async function POST(request: Request) {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    await desconectarMetaAds(restauranteId);

    return NextResponse.redirect(new URL('/admin/integracoes?status=meta-ads-desconectado', request.url), 303);
  } catch (error) {
    console.error('[meta-ads] Falha ao desconectar:', error);
    return NextResponse.redirect(new URL('/admin/integracoes?status=meta-ads-erro&motivo=erro', request.url), 303);
  }
}
