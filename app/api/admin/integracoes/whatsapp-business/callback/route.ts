import { NextResponse } from 'next/server';
import {
  concluirConexaoWhatsappBusiness,
  validarStateWhatsappBusiness,
} from '@/utils/whatsapp-business';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json({ error: 'Callback do WhatsApp Business inválido.' }, { status: 400 });
  }

  try {
    const payload = validarStateWhatsappBusiness(state);
    if (!payload.restauranteId) {
      throw new Error('State OAuth sem restaurante vinculado.');
    }

    await concluirConexaoWhatsappBusiness(code, payload.restauranteId);

    const redirectUrl = new URL('/admin/pagamentos', request.url);
    redirectUrl.searchParams.set('status', 'whatsapp-conectado');
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao concluir conexão do WhatsApp Business.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
