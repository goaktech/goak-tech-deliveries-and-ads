import { NextResponse } from 'next/server';
import { desconectarMercadoPago, obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';

export async function POST(request: Request) {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    await desconectarMercadoPago(restauranteId);

    return NextResponse.redirect(new URL('/admin/pagamentos?status=desconectado', request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao desconectar Mercado Pago.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
