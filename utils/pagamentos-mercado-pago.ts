import { createHmac, timingSafeEqual } from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { obterTokenMercadoPagoValido } from '@/utils/mercado-pago';

const MP_API_BASE = 'https://api.mercadopago.com';
const TOLERANCIA_ASSINATURA_MS = 15 * 60 * 1000;

export interface PagamentoMercadoPago {
  id: number | string;
  status: string;
  status_detail?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  metadata?: Record<string, unknown>;
  external_reference?: string;
  transaction_amount?: number;
  transaction_amount_refunded?: number;
  date_created?: string;
}

export function arredondarMoeda(valor: number) {
  return Math.round(valor * 100) / 100;
}

export function valoresIguais(a: number, b: number) {
  return Math.abs(arredondarMoeda(a) - arredondarMoeda(b)) < 0.01;
}

export type ResultadoAssinatura = 'valida' | 'invalida' | 'ausente' | 'sem_segredo';

/** Valida o header x-signature do webhook do Mercado Pago (HMAC-SHA256). */
export function verificarAssinaturaWebhook(request: Request, dataId: string): ResultadoAssinatura {
  const segredo = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  const assinatura = request.headers.get('x-signature');
  if (!segredo) {
    return 'sem_segredo';
  }
  if (!assinatura) {
    return 'ausente';
  }

  const partes = Object.fromEntries(
    assinatura.split(',').map((parte) => {
      const [chave, ...resto] = parte.trim().split('=');
      return [chave, resto.join('=')];
    })
  ) as Record<string, string>;
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) {
    return 'invalida';
  }

  const tsNumero = Number(ts);
  const tsMs = tsNumero < 1e12 ? tsNumero * 1000 : tsNumero;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > TOLERANCIA_ASSINATURA_MS) {
    return 'invalida';
  }

  const requestId = request.headers.get('x-request-id') ?? '';
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifesto = `id:${id};request-id:${requestId};ts:${ts};`;
  const esperado = createHmac('sha256', segredo).update(manifesto).digest('hex');

  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b) ? 'valida' : 'invalida';
}

export async function buscarPagamentoMercadoPago(accessToken: string, paymentId: string) {
  const response = await fetch(`${MP_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Falha ao consultar pagamento ${paymentId}.`);
  }
  return payload as PagamentoMercadoPago;
}

export async function buscarPagamentosPorExternalReference(accessToken: string, externalReference: string) {
  const url = new URL(`${MP_API_BASE}/v1/payments/search`);
  url.searchParams.set('external_reference', externalReference);
  url.searchParams.set('sort', 'date_created');
  url.searchParams.set('criteria', 'desc');
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Falha ao pesquisar pagamentos no Mercado Pago.');
  }
  return ((payload?.results ?? []) as PagamentoMercadoPago[]).filter(
    (pagamento) => pagamento.external_reference === externalReference
  );
}

/** Cancela um pagamento ainda pendente (ex.: PIX não pago) para evitar cobrança dupla. */
export async function cancelarPagamentoPendenteMercadoPago(accessToken: string, paymentId: string) {
  const response = await fetch(`${MP_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  return response.ok;
}

export async function registrarPagamentoPedido(params: {
  pedidoId: string;
  restauranteId: string;
  pagamento: PagamentoMercadoPago;
  duplicado?: boolean;
}) {
  const supabase = createWebhookAdminClient();
  const { pagamento } = params;
  const linha: Record<string, unknown> = {
    pedido_id: params.pedidoId,
    restaurante_id: params.restauranteId,
    mercado_pago_payment_id: String(pagamento.id),
    status: pagamento.status,
    metodo: pagamento.payment_type_id ?? pagamento.payment_method_id ?? null,
    valor: arredondarMoeda(Number(pagamento.transaction_amount ?? 0)),
    valor_estornado: arredondarMoeda(Number(pagamento.transaction_amount_refunded ?? 0)),
    updated_at: new Date().toISOString(),
  };
  if (params.duplicado !== undefined) {
    linha.duplicado = params.duplicado;
  }
  const { error } = await supabase
    .from('pagamentos_pedido')
    .upsert(linha, { onConflict: 'mercado_pago_payment_id' });
  if (error) {
    throw new Error(`Falha ao registrar pagamento do pedido: ${error.message}`);
  }
}

export class ErroEstornoMercadoPago extends Error {
  constructor(message: string, readonly httpStatus = 502) {
    super(message);
    this.name = 'ErroEstornoMercadoPago';
  }
}

/** Executa o estorno no Mercado Pago (total quando valor omitido) e registra em estornos_pedido. */
export async function estornarPagamentoMercadoPago(params: {
  restauranteId: string;
  pedidoId: string;
  paymentId: string;
  valor?: number;
  motivo?: string | null;
  cancelouPedido?: boolean;
  solicitadoPor?: string | null;
  idempotencyKey: string;
}) {
  const supabase = createWebhookAdminClient();
  const accessToken = await obterTokenMercadoPagoValido(params.restauranteId);
  const pagamento = await buscarPagamentoMercadoPago(accessToken, params.paymentId);
  const valorPagamento = Number(pagamento.transaction_amount ?? 0);
  const jaEstornado = Number(pagamento.transaction_amount_refunded ?? 0);
  const restante = arredondarMoeda(valorPagamento - jaEstornado);

  if (pagamento.status !== 'approved' && pagamento.status !== 'refunded') {
    throw new ErroEstornoMercadoPago(`Pagamento não está aprovado (status: ${pagamento.status}).`, 409);
  }
  if (restante <= 0) {
    throw new ErroEstornoMercadoPago('Este pagamento já foi totalmente estornado.', 409);
  }

  const valor = params.valor === undefined ? restante : arredondarMoeda(params.valor);
  if (!(valor > 0) || valor > restante + 0.001) {
    throw new ErroEstornoMercadoPago(`Valor inválido. Máximo disponível para estorno: R$ ${restante.toFixed(2)}.`, 400);
  }
  const total = valoresIguais(valor, restante) && jaEstornado === 0;

  const response = await fetch(`${MP_API_BASE}/v1/payments/${encodeURIComponent(params.paymentId)}/refunds`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'X-Idempotency-Key': params.idempotencyKey,
    },
    body: JSON.stringify(total ? {} : { amount: valor }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const mensagem = payload?.message || payload?.error || `Mercado Pago recusou o estorno (${response.status}).`;
    await supabase.from('estornos_pedido').insert({
      pedido_id: params.pedidoId,
      restaurante_id: params.restauranteId,
      mercado_pago_payment_id: params.paymentId,
      valor,
      tipo: total ? 'TOTAL' : 'PARCIAL',
      motivo: params.motivo ?? null,
      status: 'FALHOU',
      cancelou_pedido: false,
      solicitado_por: params.solicitadoPor ?? null,
      erro: String(mensagem).slice(0, 500),
    });
    throw new ErroEstornoMercadoPago(String(mensagem), response.status >= 500 ? 502 : 422);
  }

  const { data: registro } = await supabase
    .from('estornos_pedido')
    .insert({
      pedido_id: params.pedidoId,
      restaurante_id: params.restauranteId,
      mercado_pago_payment_id: params.paymentId,
      mercado_pago_refund_id: payload?.id != null ? String(payload.id) : null,
      valor,
      tipo: total || valoresIguais(valor, restante) ? 'TOTAL' : 'PARCIAL',
      motivo: params.motivo ?? null,
      status: 'CONCLUIDO',
      cancelou_pedido: params.cancelouPedido ?? false,
      solicitado_por: params.solicitadoPor ?? null,
    })
    .select('id')
    .single();

  await supabase
    .from('pagamentos_pedido')
    .update({
      valor_estornado: arredondarMoeda(jaEstornado + valor),
      status: valoresIguais(jaEstornado + valor, valorPagamento) ? 'refunded' : 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('mercado_pago_payment_id', params.paymentId);

  return { estornoId: registro?.id as string | undefined, valor, refundId: payload?.id as string | number | undefined };
}
