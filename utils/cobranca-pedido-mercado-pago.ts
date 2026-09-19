import { NextResponse } from 'next/server';
import {
  montarMetadataPedido,
  montarNotificationUrlMercadoPago,
  normalizarEmailPayer,
  obterEmailPrincipalPix,
  obterTokenMercadoPagoValido,
} from '@/utils/mercado-pago';
import { atualizarStatusPedidoComNotificacoes } from '@/utils/pedidos-acompanhamento';
import { tiposMercadoPagoExcluidos, type FormaPagamentoLoja } from '@/utils/formas-pagamento';
import type { DadosClientePedido } from '@/utils/pedido-status';

// Cobrança de um pedido JÁ CRIADO (PENDENTE) no Mercado Pago. Usada pelo checkout (pedido novo)
// e pela nova tentativa de pagamento (mesmo pedido, outra forma de pagamento ou outro cartão).

const MP_API_BASE = 'https://api.mercadopago.com';

/** Dados gerados pelo formulário de cartão embutido (Card Payment Brick). O cartão em si nunca chega aqui: só o token. */
export interface DadosCartaoEmbutido {
  token: string;
  payment_method_id: string;
  issuer_id?: string | number | null;
  installments?: number;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
  device_id?: string | null;
}

export interface ItemPrecificado {
  item_cardapio_id: string;
  quantidade: number;
  nome: string;
  precoUnitario: number;
  adicionais: Array<{ id: string; nome: string; preco_adicional: number }>;
}

export function lerDadosCartaoEmbutido(valor: unknown): DadosCartaoEmbutido | null {
  if (!valor || typeof valor !== 'object') return null;
  const cartao = valor as DadosCartaoEmbutido;
  const documento = cartao.payer?.identification;
  if (typeof cartao.token !== 'string' || !cartao.token.trim()) return null;
  if (typeof cartao.payment_method_id !== 'string' || !cartao.payment_method_id.trim()) return null;
  if (typeof documento?.type !== 'string' || typeof documento?.number !== 'string') return null;
  return cartao;
}

const MENSAGENS_RECUSA_CARTAO: Record<string, string> = {
  cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente no cartão. Tente outro cartão.',
  cc_rejected_bad_filled_card_number: 'Confira o número do cartão.',
  cc_rejected_bad_filled_date: 'Confira a data de validade do cartão.',
  cc_rejected_bad_filled_security_code: 'Confira o código de segurança (CVV).',
  cc_rejected_bad_filled_other: 'Confira os dados do cartão e tente novamente.',
  cc_rejected_call_for_authorize: 'Seu banco precisa autorizar este pagamento. Fale com o banco ou use outro cartão.',
  cc_rejected_card_disabled: 'Este cartão está desabilitado. Ative-o com o banco ou use outro cartão.',
  cc_rejected_duplicated_payment: 'Você já fez um pagamento igual a este. Confira o acompanhamento do pedido.',
  cc_rejected_high_risk: 'Este pagamento foi recusado pelos controles de segurança do Mercado Pago. Tente outro cartão ou PIX.',
  cc_rejected_max_attempts: 'Limite de tentativas atingido. Tente outro cartão ou PIX.',
};

export interface ParamsCobrancaPedido {
  appUrl: string;
  slug: string;
  restaurante: { id: string; nome: string };
  pedido: { id: string; codigoAcompanhamento: string };
  externalReference: string;
  paymentMethod: 'PIX' | 'CARTAO';
  cartaoEmbutido: DadosCartaoEmbutido | null;
  dadosCliente: DadosClientePedido;
  /** Itens no formato dos metadados do Mercado Pago (id + quantidade + adicionais). */
  itensMetadata: unknown;
  itensPrecificados: ItemPrecificado[];
  taxaEntrega: number;
  valorTotal: number;
  formasAceitas: FormaPagamentoLoja[];
  tempoPreparoEstimadoMin: number | null;
  tempoDeslocamentoMin: number | null;
  idempotencyKey: string;
}

export async function cobrarPedidoMercadoPago(params: ParamsCobrancaPedido): Promise<NextResponse> {
  const {
    appUrl,
    slug,
    restaurante,
    pedido,
    externalReference,
    paymentMethod,
    cartaoEmbutido,
    dadosCliente,
    itensMetadata: itens,
    itensPrecificados,
    taxaEntrega,
    valorTotal,
    formasAceitas,
    tempoPreparoEstimadoMin,
    tempoDeslocamentoMin,
    idempotencyKey,
  } = params;

  const trackingUrl = `${appUrl}/${slug}/acompanhar/${pedido.codigoAcompanhamento}`;
  const accessToken = await obterTokenMercadoPagoValido(restaurante.id);
  const notificationUrl = montarNotificationUrlMercadoPago(appUrl, restaurante.id);
  const metadata = montarMetadataPedido({
    slug,
    pedidoId: pedido.id,
    codigoAcompanhamento: pedido.codigoAcompanhamento,
    externalReference,
    restauranteId: restaurante.id,
    metodoPagamento: paymentMethod,
    dadosCliente,
    itens,
  });
  const emailPayer = normalizarEmailPayer(dadosCliente.email, slug, dadosCliente.telefone);

  if (paymentMethod === 'PIX') {
    const response = await fetch(`${MP_API_BASE}/v1/payments`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: Number(valorTotal.toFixed(2)),
        description: `${restaurante.nome} - Pedido`,
        payment_method_id: 'pix',
        notification_url: notificationUrl,
        external_reference: externalReference,
        payer: {
          email: obterEmailPrincipalPix(),
          first_name: dadosCliente.nome.trim().split(/\s+/)[0],
          last_name: dadosCliente.nome.trim().split(/\s+/).slice(1).join(' ') || 'Cliente',
        },
        metadata,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || 'Falha ao gerar pagamento PIX.');
    }

    const transactionData = payload?.point_of_interaction?.transaction_data ?? {};

    return NextResponse.json({
      pedido_id: pedido.id,
      codigo_acompanhamento: pedido.codigoAcompanhamento,
      tracking_url: trackingUrl,
      payment_id: payload.id,
      qr_code: transactionData.qr_code ?? '',
      qr_code_base64: transactionData.qr_code_base64 ?? '',
      ticket_url: transactionData.ticket_url ?? '',
      tempo_preparo_estimado_min: tempoPreparoEstimadoMin,
      tempo_deslocamento_min: tempoDeslocamentoMin,
    });
  }

  if (cartaoEmbutido) {
    const nomeCompleto = dadosCliente.nome.trim();
    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-idempotency-key': idempotencyKey,
    };
    if (cartaoEmbutido.device_id) {
      headers['x-meli-session-id'] = String(cartaoEmbutido.device_id);
    }

    const emissor = Number(cartaoEmbutido.issuer_id);
    const pagamentoResponse = await fetch(`${MP_API_BASE}/v1/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        // o valor é SEMPRE o calculado aqui no servidor, nunca o do navegador
        transaction_amount: Number(valorTotal.toFixed(2)),
        token: cartaoEmbutido.token,
        description: `${restaurante.nome} - Pedido`,
        installments: 1,
        payment_method_id: cartaoEmbutido.payment_method_id,
        ...(Number.isFinite(emissor) && emissor > 0 ? { issuer_id: emissor } : {}),
        notification_url: notificationUrl,
        external_reference: externalReference,
        payer: {
          email: cartaoEmbutido.payer?.email?.trim() || emailPayer,
          first_name: nomeCompleto.split(/\s+/)[0],
          last_name: nomeCompleto.split(/\s+/).slice(1).join(' ') || 'Cliente',
          identification: {
            type: String(cartaoEmbutido.payer?.identification?.type),
            number: String(cartaoEmbutido.payer?.identification?.number).replace(/\D/g, ''),
          },
        },
        additional_info: {
          items: itensPrecificados.map((item) => ({
            id: item.item_cardapio_id,
            title: item.nome,
            quantity: item.quantidade,
            unit_price: item.precoUnitario,
          })),
        },
        metadata,
      }),
    });

    const pagamento = await pagamentoResponse.json();
    if (!pagamentoResponse.ok) {
      console.error('Mercado Pago recusou a criação do pagamento com cartão:', pagamento);
      return NextResponse.json(
        { error: 'Não foi possível processar o cartão. Confira os dados e tente novamente.' },
        { status: 400 }
      );
    }

    console.log('Pagamento com cartão criado:', {
      payment_id: pagamento?.id,
      status: pagamento?.status,
      status_detail: pagamento?.status_detail,
      payment_type_id: pagamento?.payment_type_id,
      payment_method_id: pagamento?.payment_method_id,
    });

    const statusPagamento = String(pagamento?.status ?? '');
    const respostaBase = {
      pedido_id: pedido.id,
      codigo_acompanhamento: pedido.codigoAcompanhamento,
      tracking_url: trackingUrl,
      payment_id: pagamento.id,
      tempo_preparo_estimado_min: tempoPreparoEstimadoMin,
      tempo_deslocamento_min: tempoDeslocamentoMin,
    };

    if (statusPagamento === 'approved') {
      try {
        // o webhook também fará isso (é idempotente); aqui só adianta a confirmação para o cliente
        await atualizarStatusPedidoComNotificacoes({
          pedidoId: pedido.id,
          novoStatus: 'PAGO',
          mercadoPagoPaymentId: String(pagamento.id),
        });
      } catch (erroAtualizacao) {
        console.error('Pagamento aprovado, mas falhou ao atualizar o pedido (o webhook concilia):', erroAtualizacao);
      }
      return NextResponse.json({ ...respostaBase, status: 'approved' });
    }

    if (statusPagamento === 'rejected') {
      const detalhe = String(pagamento?.status_detail ?? '');
      return NextResponse.json({
        ...respostaBase,
        status: 'rejected',
        mensagem:
          MENSAGENS_RECUSA_CARTAO[detalhe] ??
          'O pagamento foi recusado. Tente outro cartão ou escolha PIX.',
      });
    }

    // in_process / pending: o webhook confirma depois; a tela de acompanhamento atualiza sozinha
    return NextResponse.json({ ...respostaBase, status: 'in_process' });
  }

  const itensPreferencia = itensPrecificados.map((item) => ({
    id: item.item_cardapio_id,
    title:
      item.adicionais.length > 0
        ? `${item.nome} (+ ${item.adicionais.map((adicional) => adicional.nome).join(', ')})`
        : item.nome,
    quantity: item.quantidade,
    unit_price: item.precoUnitario,
    currency_id: 'BRL',
  }));

  if (taxaEntrega > 0) {
    itensPreferencia.push({
      id: 'taxa-entrega',
      title: 'Taxa de entrega',
      quantity: 1,
      unit_price: taxaEntrega,
      currency_id: 'BRL',
    });
  }

  const preferenceResponse = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      items: itensPreferencia,
      // mostra no checkout do Mercado Pago só crédito e/ou débito, conforme a loja aceita
      payment_methods: {
        excluded_payment_types: tiposMercadoPagoExcluidos(formasAceitas),
      },
      payer: {
        email: emailPayer,
      },
      external_reference: externalReference,
      notification_url: notificationUrl,
      back_urls: {
        success: `${trackingUrl}?pagamento=aprovado`,
        pending: `${trackingUrl}?pagamento=pendente`,
        failure: `${trackingUrl}?pagamento=falhou`,
      },
      auto_return: 'approved',
      metadata,
    }),
  });

  const preferencePayload = await preferenceResponse.json();
  if (!preferenceResponse.ok) {
    throw new Error(preferencePayload?.message || 'Falha ao gerar checkout com cartão.');
  }

  return NextResponse.json({
    pedido_id: pedido.id,
    codigo_acompanhamento: pedido.codigoAcompanhamento,
    tracking_url: trackingUrl,
    preference_id: preferencePayload.id,
    checkout_url: preferencePayload.init_point ?? preferencePayload.sandbox_init_point ?? '',
  });
}
