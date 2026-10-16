import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    return new NextResponse('Webhook não configurado.', { status: 500 });
  }

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Token de verificação inválido.', { status: 403 });
}

const ORDEM_STATUS: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

function assinaturaValida(corpo: string, cabecalho: string | null) {
  const segredo = process.env.WHATSAPP_META_APP_SECRET;
  if (!segredo || !cabecalho?.startsWith('sha256=')) return false;

  const esperado = createHmac('sha256', segredo).update(corpo).digest();
  const recebido = Buffer.from(cabecalho.slice('sha256='.length), 'hex');
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

interface StatusMeta {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: unknown;
}

async function aplicarStatus(tabela: 'notificacoes_pedido' | 'avisos_venda_whatsapp', status: StatusMeta) {
  if (!status.id || !status.status) return;
  const supabase = createWebhookAdminClient();

  const { data: atual } = await supabase
    .from(tabela)
    .select('id, entrega_status')
    .eq('provider_message_id', status.id)
    .maybeSingle();
  if (!atual) return;

  // Eventos podem chegar fora de ordem: nunca "volta" de lido para entregue. Falha sempre vale.
  const novo = ORDEM_STATUS[status.status] ?? 0;
  const anterior = ORDEM_STATUS[atual.entrega_status ?? ''] ?? 0;
  if (status.status !== 'failed' && novo <= anterior) return;

  const quando = status.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString();
  const atualizacao: Record<string, unknown> = { entrega_status: status.status, entrega_status_em: quando };
  if (status.status === 'failed') {
    atualizacao.sucesso = false;
    atualizacao.erro_json = { errors: status.errors ?? null };
  }
  await supabase.from(tabela).update(atualizacao).eq('id', atual.id);
}

export async function POST(request: Request) {
  const corpo = await request.text();

  if (!assinaturaValida(corpo, request.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Assinatura inválida.', { status: 401 });
  }

  try {
    const json = JSON.parse(corpo) as {
      entry?: { changes?: { value?: { statuses?: StatusMeta[] } }[] }[];
    };

    for (const entry of json.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const status of change.value?.statuses ?? []) {
          await aplicarStatus('notificacoes_pedido', status);
          await aplicarStatus('avisos_venda_whatsapp', status);
        }
      }
    }
  } catch (erro) {
    // Responder 200 evita reenvio em loop da Meta; o erro fica nos logs.
    console.error('[whatsapp:webhook] Falha ao processar evento.', erro);
  }

  return NextResponse.json({ received: true });
}
