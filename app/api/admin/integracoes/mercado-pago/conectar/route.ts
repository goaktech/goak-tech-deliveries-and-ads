import { NextResponse } from 'next/server';
import { gerarUrlAutorizacaoMercadoPago } from '@/utils/mercado-pago';

export async function GET() {
  try {
    const { authUrl } = await gerarUrlAutorizacaoMercadoPago();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao iniciar conexão com Mercado Pago.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
