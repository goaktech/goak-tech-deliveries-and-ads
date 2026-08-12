import { NextResponse } from 'next/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

interface BodyPayload {
  token?: string;
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BodyPayload;
    const token = String(body.token ?? '').trim();
    const endpoint = String(body.subscription?.endpoint ?? '').trim();
    const p256dh = String(body.subscription?.keys?.p256dh ?? '').trim();
    const auth = String(body.subscription?.keys?.auth ?? '').trim();

    if (!token || !endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Payload de inscrição push inválido.' }, { status: 400 });
    }

    const supabase = createWebhookAdminClient();
    const { data: pedido, error: errPedido } = await supabase
      .from('pedidos')
      .select('id')
      .eq('codigo_acompanhamento', token)
      .maybeSingle();

    if (errPedido || !pedido) {
      return NextResponse.json({ error: 'Pedido não localizado para assinatura push.' }, { status: 404 });
    }

    const { error: errUpsert } = await supabase
      .from('push_subscriptions_pedido')
      .upsert(
        {
          pedido_id: pedido.id,
          endpoint,
          p256dh,
          auth,
          user_agent: request.headers.get('user-agent') ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'pedido_id,endpoint' }
      );

    if (errUpsert) {
      throw errUpsert;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao registrar assinatura push do pedido:', error);
    return NextResponse.json({ error: 'Erro interno ao registrar push.' }, { status: 500 });
  }
}
