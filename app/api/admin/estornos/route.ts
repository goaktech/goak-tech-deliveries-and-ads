import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { ErroCancelamentoPedido, cancelarPedido } from '@/utils/pedidos-acompanhamento';
import { ErroEstornoMercadoPago, estornarPagamentoMercadoPago } from '@/utils/pagamentos-mercado-pago';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Body {
  pedidoId?: unknown;
  paymentId?: unknown;
  /** Ausente = estorno total do saldo restante. */
  valor?: unknown;
  motivo?: unknown;
  cancelarPedido?: unknown;
  /** Chave de idempotência gerada ao abrir o formulário (evita estorno duplicado por duplo clique). */
  token?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { data: perfil } = await supabase
      .from('perfis_admin')
      .select('restaurante_id')
      .eq('id', user.id)
      .maybeSingle();
    if (!perfil?.restaurante_id) {
      return NextResponse.json({ error: 'Restaurante do gestor não localizado.' }, { status: 403 });
    }
    const restauranteId = perfil.restaurante_id as string;

    const pedidoId = typeof body.pedidoId === 'string' ? body.pedidoId : '';
    const paymentId = typeof body.paymentId === 'string' ? body.paymentId.trim() : '';
    const motivo = typeof body.motivo === 'string' ? body.motivo.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    const token = typeof body.token === 'string' && UUID_REGEX.test(body.token) ? body.token : null;
    const valor = body.valor === undefined || body.valor === null ? undefined : Number(body.valor);

    if (!UUID_REGEX.test(pedidoId) || !/^\d+$/.test(paymentId) || !motivo || !token) {
      return NextResponse.json({ error: 'Informe pedido, pagamento e motivo do estorno.' }, { status: 400 });
    }
    if (valor !== undefined && (!Number.isFinite(valor) || valor <= 0)) {
      return NextResponse.json({ error: 'Valor de estorno inválido.' }, { status: 400 });
    }

    // O pagamento tem que pertencer a um pedido DESTE restaurante.
    const admin = createWebhookAdminClient();
    const { data: pagamento } = await admin
      .from('pagamentos_pedido')
      .select('id, pedido_id, restaurante_id')
      .eq('mercado_pago_payment_id', paymentId)
      .eq('pedido_id', pedidoId)
      .eq('restaurante_id', restauranteId)
      .maybeSingle();
    if (!pagamento) {
      return NextResponse.json({ error: 'Pagamento não encontrado para este pedido.' }, { status: 404 });
    }

    const estorno = await estornarPagamentoMercadoPago({
      restauranteId,
      pedidoId,
      paymentId,
      valor,
      motivo,
      cancelouPedido: body.cancelarPedido === true,
      solicitadoPor: user.id,
      idempotencyKey: `estorno-${token}`,
    });

    let pedidoCancelado = false;
    let avisoCancelamento: string | null = null;
    if (body.cancelarPedido === true) {
      try {
        await cancelarPedido({ pedidoId, restauranteId, motivo: `Estorno: ${motivo}` });
        pedidoCancelado = true;
      } catch (error) {
        avisoCancelamento =
          error instanceof ErroCancelamentoPedido ? error.message : 'Não foi possível cancelar o pedido.';
      }
    }

    return NextResponse.json({ ok: true, valor: estorno.valor, pedidoCancelado, avisoCancelamento });
  } catch (error) {
    if (error instanceof ErroEstornoMercadoPago) {
      return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    }
    console.error('Erro ao processar estorno:', error);
    return NextResponse.json({ error: 'Falha ao processar o estorno. Tente novamente.' }, { status: 500 });
  }
}
