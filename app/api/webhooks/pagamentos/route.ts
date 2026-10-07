import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { atualizarStatusPedidoComNotificacoes } from '@/utils/pedidos-acompanhamento';
import { obterTokenMercadoPagoValido } from '@/utils/mercado-pago';
import {
  buscarPagamentoMercadoPago,
  estornarPagamentoMercadoPago,
  registrarPagamentoPedido,
  valoresIguais,
  verificarAssinaturaWebhook,
} from '@/utils/pagamentos-mercado-pago';

type NivelLogWebhook = 'info' | 'sucesso' | 'alerta' | 'erro';

interface ParamsRegistrarLogWebhook {
  supabase: ReturnType<typeof createWebhookAdminClient>;
  idCorrelacao: string;
  etapa: string;
  nivel: NivelLogWebhook;
  mensagem: string;
  restauranteId?: string | null;
  paymentId?: string | null;
  tipoEvento?: string | null;
  dados?: Record<string, unknown>;
  erro?: unknown;
}

function serializarErro(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      nome: error.name,
      mensagem: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'object' && error !== null) {
    return { ...(error as Record<string, unknown>) };
  }

  return { valor: String(error) };
}

function registrarConsoleWebhook({
  idCorrelacao,
  etapa,
  nivel,
  mensagem,
  restauranteId,
  paymentId,
  tipoEvento,
  dados,
  erro,
}: Omit<ParamsRegistrarLogWebhook, 'supabase'>) {
  const payloadLog = {
    contexto: 'webhook_pagamentos',
    timestamp: new Date().toISOString(),
    id_correlacao: idCorrelacao,
    etapa,
    nivel,
    mensagem,
    restaurante_id: restauranteId ?? null,
    payment_id: paymentId ?? null,
    tipo_evento: tipoEvento ?? null,
    dados: dados ?? {},
    erro: erro ? serializarErro(erro) : null,
  };

  const textoLog = JSON.stringify(payloadLog);
  if (nivel === 'erro') {
    console.error(textoLog);
    return;
  }
  if (nivel === 'alerta') {
    console.warn(textoLog);
    return;
  }
  console.log(textoLog);
}

async function registrarLogWebhook(params: ParamsRegistrarLogWebhook) {
  const {
    supabase,
    idCorrelacao,
    etapa,
    nivel,
    mensagem,
    restauranteId,
    paymentId,
    tipoEvento,
    dados,
    erro,
  } = params;

  registrarConsoleWebhook({
    idCorrelacao,
    etapa,
    nivel,
    mensagem,
    restauranteId,
    paymentId,
    tipoEvento,
    dados,
    erro,
  });

  const { error: erroInsercaoLog } = await supabase.from('logs_webhook_pagamentos').insert({
    id_correlacao: idCorrelacao,
    restaurante_id: restauranteId ?? null,
    payment_id: paymentId ?? null,
    tipo_evento: tipoEvento ?? null,
    etapa,
    nivel,
    mensagem,
    dados_json: dados ?? {},
    erro_json: erro ? serializarErro(erro) : null,
  });

  if (erroInsercaoLog) {
    console.error(
      JSON.stringify({
        contexto: 'webhook_pagamentos',
        timestamp: new Date().toISOString(),
        id_correlacao: idCorrelacao,
        etapa: 'persistencia_log',
        nivel: 'erro',
        mensagem: 'Falha ao persistir log na tabela logs_webhook_pagamentos.',
        erro: {
          codigo: erroInsercaoLog.code,
          mensagem: erroInsercaoLog.message,
          detalhe: erroInsercaoLog.details,
          hint: erroInsercaoLog.hint,
        },
      })
    );
  }
}

async function extrairCorpo(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = createWebhookAdminClient();
  const idCorrelacao = randomUUID();
  let etapaAtual = 'inicio';

  try {
    const body = await extrairCorpo(request);
    const urlWebhook = new URL(request.url);
    const restauranteIdQuery = (urlWebhook.searchParams.get('restaurante_id') ?? '').trim();
    const topicoIpn = String(body?.topic ?? urlWebhook.searchParams.get('topic') ?? '').trim();
    const tipoEvento = String(body?.type ?? body?.action ?? (topicoIpn || 'desconhecido'));

    // Notificações de merchant_order não trazem pagamento e são ignoradas de propósito.
    if (topicoIpn === 'merchant_order' || tipoEvento === 'topic_merchant_order_wh') {
      return NextResponse.json({ received: true, ignored: 'merchant_order' });
    }

    const recursoIpn = String(body?.resource ?? '').trim();
    const idRecursoIpn = /^\d+$/.test(recursoIpn) ? recursoIpn : recursoIpn.split('/').pop() ?? '';
    const paymentId = String(
      body?.data?.id ??
        urlWebhook.searchParams.get('data.id') ??
        (topicoIpn === 'payment' ? urlWebhook.searchParams.get('id') ?? idRecursoIpn : '') ??
        ''
    ).trim();

    if (!paymentId || !/^\d+$/.test(paymentId)) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'validacao_payload',
        nivel: 'alerta',
        mensagem: 'Webhook recebido sem identificador de pagamento válido.',
        restauranteId: UUID_REGEX.test(restauranteIdQuery) ? restauranteIdQuery : null,
        tipoEvento,
        dados: { body },
      });
      return NextResponse.json({ received: true });
    }

    // 1) Assinatura (x-signature). Inválida => rejeita. Ausente: segue (IPN), pois tudo é reconfirmado na API do MP.
    const assinatura = verificarAssinaturaWebhook(request, paymentId);
    if (assinatura === 'invalida' || (assinatura === 'ausente' && process.env.VERCEL_ENV === 'production')) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'validacao_assinatura',
        nivel: 'alerta',
        mensagem: 'Webhook rejeitado: assinatura inválida ou ausente.',
        paymentId,
        tipoEvento,
        dados: { assinatura },
      });
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 });
    }
    if (assinatura === 'sem_segredo' && process.env.VERCEL_ENV === 'production') {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'validacao_assinatura',
        nivel: 'erro',
        mensagem: 'MERCADO_PAGO_WEBHOOK_SECRET não configurado em produção; webhook rejeitado.',
        paymentId,
        tipoEvento,
      });
      return NextResponse.json({ error: 'Webhook não configurado.' }, { status: 503 });
    }

    // 2) Restaurante
    if (!UUID_REGEX.test(restauranteIdQuery)) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'validacao_restaurante_query',
        nivel: 'alerta',
        mensagem: 'Webhook sem restaurante_id válido na query string.',
        paymentId,
        tipoEvento,
      });
      return NextResponse.json({ received: true, ignored: 'restaurante_id_invalido' });
    }

    await registrarLogWebhook({
      supabase,
      idCorrelacao,
      etapa: 'payload_recebido',
      nivel: 'info',
      mensagem: 'Webhook de pagamento recebido.',
      restauranteId: restauranteIdQuery,
      paymentId,
      tipoEvento,
      dados: { assinatura },
    });

    etapaAtual = 'consulta_pagamento_mercado_pago';
    let accessToken: string;
    try {
      accessToken = await obterTokenMercadoPagoValido(restauranteIdQuery);
    } catch (error) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'carregamento_integracao_restaurante',
        nivel: 'erro',
        mensagem: 'Integração Mercado Pago indisponível para este restaurante.',
        restauranteId: restauranteIdQuery,
        paymentId,
        erro: error,
      });
      return NextResponse.json({ error: 'Integração Mercado Pago indisponível.' }, { status: 409 });
    }

    // A API só devolve pagamentos da conta do restaurante: ID forjado de outra conta falha aqui.
    const pagamento = await buscarPagamentoMercadoPago(accessToken, paymentId);

    // 3) external_reference -> pedido do MESMO restaurante
    etapaAtual = 'validacao_pedido';
    const externalReference = String(pagamento.external_reference ?? '').trim();
    if (!externalReference) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: etapaAtual,
        nivel: 'alerta',
        mensagem: 'Pagamento sem external_reference; ignorado.',
        restauranteId: restauranteIdQuery,
        paymentId,
      });
      return NextResponse.json({ received: true, ignored: 'sem_external_reference' });
    }

    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id, status, valor_total, restaurante_id, mercado_pago_payment_id, mercado_pago_external_reference')
      .eq('mercado_pago_external_reference', externalReference)
      .maybeSingle();

    if (!pedido || pedido.restaurante_id !== restauranteIdQuery) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: etapaAtual,
        nivel: 'alerta',
        mensagem: 'Nenhum pedido deste restaurante corresponde ao external_reference do pagamento; ignorado.',
        restauranteId: restauranteIdQuery,
        paymentId,
        dados: { external_reference: externalReference, pedido_de_outro_restaurante: !!pedido },
      });
      return NextResponse.json({ received: true, ignored: 'pedido_nao_encontrado' });
    }

    const pedidoIdMetadata = String(pagamento.metadata?.pedidoId ?? pagamento.metadata?.pedido_id ?? '').trim();
    if (pedidoIdMetadata && pedidoIdMetadata !== pedido.id) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: etapaAtual,
        nivel: 'alerta',
        mensagem: 'metadata.pedidoId diverge do pedido localizado pelo external_reference; ignorado.',
        restauranteId: restauranteIdQuery,
        paymentId,
        dados: { pedido_id: pedido.id, pedido_id_metadata: pedidoIdMetadata },
      });
      return NextResponse.json({ received: true, ignored: 'metadata_divergente' });
    }

    // 4) Valor
    const valorPago = Number(pagamento.transaction_amount ?? 0);
    const valorConfere = valoresIguais(valorPago, Number(pedido.valor_total));

    // Registro do pagamento (qualquer status) para histórico/estorno.
    const { data: registroExistente } = await supabase
      .from('pagamentos_pedido')
      .select('id, duplicado')
      .eq('mercado_pago_payment_id', String(pagamento.id))
      .maybeSingle();

    if (pagamento.status !== 'approved') {
      await registrarPagamentoPedido({ pedidoId: pedido.id, restauranteId: pedido.restaurante_id, pagamento });
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'validacao_status_pagamento',
        nivel: 'info',
        mensagem: `Pagamento com status "${pagamento.status}"; pedido não alterado para PAGO.`,
        restauranteId: restauranteIdQuery,
        paymentId,
        dados: { status_pagamento: pagamento.status, pedido_id: pedido.id },
      });
      return NextResponse.json({ received: true });
    }

    if (!valorConfere) {
      await registrarPagamentoPedido({ pedidoId: pedido.id, restauranteId: pedido.restaurante_id, pagamento });
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'validacao_valor',
        nivel: 'erro',
        mensagem: 'Valor do pagamento diverge do total do pedido; pedido NÃO foi marcado como pago.',
        restauranteId: restauranteIdQuery,
        paymentId,
        dados: { valor_pago: valorPago, valor_pedido: Number(pedido.valor_total), pedido_id: pedido.id },
      });
      return NextResponse.json({ received: true, ignored: 'valor_divergente' });
    }

    // 5) Duplicidade / pagamento tardio -> estorno automático
    const jaTemOutroPagamento =
      !!pedido.mercado_pago_payment_id && pedido.mercado_pago_payment_id !== String(pagamento.id);
    let outroPagamentoAprovado = false;
    if (jaTemOutroPagamento) {
      const { data: outro } = await supabase
        .from('pagamentos_pedido')
        .select('status, valor, valor_estornado')
        .eq('mercado_pago_payment_id', pedido.mercado_pago_payment_id as string)
        .maybeSingle();
      outroPagamentoAprovado = !!outro && outro.status === 'approved' && Number(outro.valor_estornado) < Number(outro.valor);
    }
    const duplicado = outroPagamentoAprovado || (registroExistente?.duplicado ?? false);
    const pedidoCancelado = pedido.status === 'CANCELADO';

    const tratarDuplicado = async (cancelado: boolean) => {
      await registrarPagamentoPedido({ pedidoId: pedido.id, restauranteId: pedido.restaurante_id, pagamento, duplicado: true });
      const motivo = cancelado
        ? 'Estorno automático: pagamento aprovado após o cancelamento do pedido.'
        : 'Estorno automático: pagamento duplicado para o mesmo pedido.';
      try {
        const estorno = await estornarPagamentoMercadoPago({
          restauranteId: pedido.restaurante_id,
          pedidoId: pedido.id,
          paymentId: String(pagamento.id),
          motivo,
          idempotencyKey: `auto-estorno-${pagamento.id}`,
        });
        await registrarLogWebhook({
          supabase,
          idCorrelacao,
          etapa: 'estorno_automatico',
          nivel: 'sucesso',
          mensagem: motivo,
          restauranteId: restauranteIdQuery,
          paymentId,
          dados: { pedido_id: pedido.id, valor: estorno.valor },
        });
      } catch (error) {
        await registrarLogWebhook({
          supabase,
          idCorrelacao,
          etapa: 'estorno_automatico',
          nivel: 'erro',
          mensagem: 'Falha ao estornar automaticamente; estorne manualmente na aba Estornos.',
          restauranteId: restauranteIdQuery,
          paymentId,
          dados: { pedido_id: pedido.id },
          erro: error,
        });
      }
      return NextResponse.json({ received: true, ignored: cancelado ? 'pedido_cancelado' : 'pagamento_duplicado' });
    };

    if (duplicado || pedidoCancelado) {
      return await tratarDuplicado(pedidoCancelado);
    }

    // 6) Confirma: só PENDENTE vira PAGO; webhooks repetidos nunca regridem o pedido.
    etapaAtual = 'atualizacao_status_pedido';
    await registrarPagamentoPedido({ pedidoId: pedido.id, restauranteId: pedido.restaurante_id, pagamento, duplicado: false });
    const resultado = await atualizarStatusPedidoComNotificacoes({
      pedidoId: pedido.id,
      novoStatus: pedido.status === 'PENDENTE' ? 'PAGO' : pedido.status,
      mercadoPagoPaymentId: String(pagamento.id),
    });

    if (
      resultado.pedido.mercado_pago_payment_id &&
      resultado.pedido.mercado_pago_payment_id !== String(pagamento.id)
    ) {
      // Outro pagamento venceu a corrida para este pedido.
      return await tratarDuplicado(false);
    }

    await registrarLogWebhook({
      supabase,
      idCorrelacao,
      etapa: 'atualizacao_status_pedido',
      nivel: 'sucesso',
      mensagem: resultado.mudouStatus ? 'Pedido atualizado para PAGO.' : 'Webhook repetido; pedido já sincronizado.',
      restauranteId: restauranteIdQuery,
      paymentId,
      dados: { pedido_id: pedido.id, status_final: resultado.pedido.status },
    });

    return NextResponse.json({ received: true, pedido_id: pedido.id });
  } catch (error: unknown) {
    await registrarLogWebhook({
      supabase,
      idCorrelacao,
      etapa: etapaAtual,
      nivel: 'erro',
      mensagem: 'Erro interno durante processamento do webhook Mercado Pago.',
      erro: error,
    });

    return NextResponse.json({ error: 'Erro interno ao processar webhook.' }, { status: 500 });
  }
}
