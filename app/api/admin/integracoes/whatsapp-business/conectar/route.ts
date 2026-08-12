import { NextResponse } from 'next/server';
import { gerarUrlAutorizacaoWhatsappBusiness } from '@/utils/whatsapp-business';

export async function GET() {
  try {
    const { authUrl } = await gerarUrlAutorizacaoWhatsappBusiness();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao iniciar conexão com WhatsApp Business.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
