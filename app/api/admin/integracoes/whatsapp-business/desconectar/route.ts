import { NextResponse } from 'next/server';
import { desconectarWhatsappBusiness } from '@/utils/whatsapp-business';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';

export async function POST(request: Request) {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    await desconectarWhatsappBusiness(restauranteId);

    return NextResponse.redirect(new URL('/admin/pagamentos?status=whatsapp-desconectado', request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao desconectar WhatsApp Business.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
