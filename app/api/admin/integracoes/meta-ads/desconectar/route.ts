import { NextResponse } from 'next/server';
import { desconectarMetaAds } from '@/utils/meta-ads';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';

export async function POST(request: Request) {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    await desconectarMetaAds(restauranteId);

    return NextResponse.redirect(new URL('/admin/pagamentos?status=meta-ads-desconectado', request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao desconectar Meta Ads.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
