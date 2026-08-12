import { NextResponse } from 'next/server';
import {
  obterUsuarioMercadoPago,
  salvarIntegracaoMercadoPago,
  trocarCodigoPorTokensMercadoPago,
  validarStateMercadoPago,
} from '@/utils/mercado-pago';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json({ error: 'Callback inválido.' }, { status: 400 });
  }

  try {
    const payload = validarStateMercadoPago(state);
    if (!payload.restauranteId) {
      throw new Error('State OAuth sem restaurante vinculado.');
    }
    const tokens = await trocarCodigoPorTokensMercadoPago(code);
    const usuario = await obterUsuarioMercadoPago(tokens.access_token);

    await salvarIntegracaoMercadoPago(payload.restauranteId, tokens, usuario);

    const supabase = createWebhookAdminClient();
    const { data: restaurante } = await supabase
      .from('restaurantes')
      .select('slug')
      .eq('id', payload.restauranteId)
      .maybeSingle();

    const redirectUrl = new URL('/admin/pagamentos', request.url);
    redirectUrl.searchParams.set('status', 'conectado');
    if (restaurante?.slug) {
      redirectUrl.searchParams.set('slug', restaurante.slug);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao concluir conexão.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
