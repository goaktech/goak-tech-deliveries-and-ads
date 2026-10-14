// utils/ifood-pedidos.ts
// Pedidos recebidos do iFood (módulo Order): vendas feitas no app do iFood para
// a loja conectada. Chegam pelo polling de eventos (PLACED), ficam em
// `pedidos_ifood` e a cozinha confirma, cancela, marca como pronto e despacha.
// As vendas do próprio goak continuam em `pedidos`; a entrega delas pelo iFood
// (Shipping) está em utils/ifood-entrega.ts.

import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { obterAccessTokenIfood, requisicaoIfood } from '@/utils/ifood';

export type StatusPedidoIfood =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARATION_STARTED'
  | 'READY_TO_PICKUP'
  | 'DISPATCHED'
  | 'CONCLUDED'
  | 'CANCELLATION_REQUESTED'
  | 'CANCELLED';

export type AcaoPedidoIfood = 'confirmar' | 'pronto' | 'despachar';

export interface ItemPedidoIfood {
  nome: string;
  quantidade: number;
  observacoes: string | null;
  opcoes: string[];
}

/** O que a cozinha recebe: só o necessário pra operar o pedido. */
export interface PedidoIfoodCozinha {
  id: string;
  numero: string | null;
  status: StatusPedidoIfood;
  ultimoEvento: string | null;
  tipo: string | null;
  entregaPor: string | null;
  clienteNome: string | null;
  total: number | null;
  endereco: string | null;
  observacoes: string | null;
  itens: ItemPedidoIfood[];
  criadoEm: string;
}

interface DetalhesPedidoIfood {
  id: string;
  displayId?: string;
  orderType?: string;
  customer?: { name?: string };
  items?: Array<{
    name?: string;
    quantity?: number;
    observations?: string;
    options?: Array<{ name?: string; quantity?: number }>;
  }>;
  total?: { orderAmount?: number };
  delivery?: { deliveredBy?: string; observations?: string; deliveryAddress?: { formattedAddress?: string; neighborhood?: string } };
}

interface LinhaPedidoIfood {
  ifood_order_id: string;
  display_id: string | null;
  status: StatusPedidoIfood;
  ultimo_evento: string | null;
  tipo: string | null;
  entrega_por: string | null;
  cliente_nome: string | null;
  total: number | string | null;
  detalhes: DetalhesPedidoIfood | null;
  criado_em: string;
}

// Eventos de status do pedido (fullCode) que mudam a coluna `status`.
const STATUS_POR_EVENTO: Record<string, StatusPedidoIfood> = {
  PLACED: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  PREPARATION_STARTED: 'PREPARATION_STARTED',
  READY_TO_PICKUP: 'READY_TO_PICKUP',
  DISPATCHED: 'DISPATCHED',
  CONCLUDED: 'CONCLUDED',
  CANCELLED: 'CANCELLED',
};

const ENDPOINT_ACAO: Record<AcaoPedidoIfood, { caminho: string; status: StatusPedidoIfood; nome: string }> = {
  confirmar: { caminho: 'confirm', status: 'CONFIRMED', nome: 'a confirmação' },
  pronto: { caminho: 'readyToPickup', status: 'READY_TO_PICKUP', nome: 'o aviso de pedido pronto' },
  despachar: { caminho: 'dispatch', status: 'DISPATCHED', nome: 'o despacho' },
};

const JANELA_LISTA_MS = 12 * 60 * 60 * 1000;

function getSupabase() {
  return createWebhookAdminClient();
}

function detalheErro(corpo: unknown) {
  const erro = (corpo ?? {}) as { message?: string; error?: { message?: string } };
  return erro.message ?? erro.error?.message ?? null;
}

async function carregar(restauranteId: string, ifoodOrderId: string) {
  const { data } = await getSupabase()
    .from('pedidos_ifood')
    .select('ifood_order_id, status')
    .eq('restaurante_id', restauranteId)
    .eq('ifood_order_id', ifoodOrderId)
    .maybeSingle();
  if (!data) {
    throw new Error('Pedido do iFood não encontrado.');
  }
  return data as { ifood_order_id: string; status: StatusPedidoIfood };
}

/**
 * Aplica um evento de pedido que não é uma entrega Shipping do goak. PLACED
 * busca os detalhes e cria o pedido; os demais atualizam o que já existe.
 * Devolve false quando o evento não é de um pedido recebido do iFood.
 */
export async function aplicarEventoPedidoIfood(
  restauranteId: string,
  accessToken: string,
  evento: { orderId?: string; code?: string; fullCode?: string; createdAt?: string }
) {
  if (!evento.orderId) return false;
  const codigo = evento.fullCode ?? evento.code ?? '';
  const supabase = getSupabase();

  if (codigo === 'PLACED') {
    const resposta = await requisicaoIfood<DetalhesPedidoIfood>(`/order/v1.0/orders/${evento.orderId}`, { accessToken });
    if (resposta.status !== 200 || !resposta.body) {
      throw new Error(`Não foi possível buscar os detalhes do pedido ${evento.orderId} no iFood (HTTP ${resposta.status}).`);
    }
    const detalhes = resposta.body;
    // ignoreDuplicates: PLACED repetido não pode voltar o status de um pedido já confirmado.
    const { error } = await supabase.from('pedidos_ifood').upsert(
      {
        ifood_order_id: evento.orderId,
        restaurante_id: restauranteId,
        display_id: detalhes.displayId ?? null,
        status: 'PLACED',
        ultimo_evento: codigo,
        tipo: detalhes.orderType ?? null,
        entrega_por: detalhes.delivery?.deliveredBy ?? null,
        cliente_nome: detalhes.customer?.name ?? null,
        total: detalhes.total?.orderAmount ?? null,
        detalhes,
        criado_em: evento.createdAt ?? new Date().toISOString(),
      },
      { onConflict: 'ifood_order_id', ignoreDuplicates: true }
    );
    if (error) {
      throw new Error(`Falha ao gravar o pedido do iFood: ${error.message}`);
    }
    return true;
  }

  const campos: Record<string, unknown> = { ultimo_evento: codigo, atualizado_em: new Date().toISOString() };
  if (STATUS_POR_EVENTO[codigo]) {
    campos.status = STATUS_POR_EVENTO[codigo];
  } else if (codigo === 'CANCELLATION_REQUEST_FAILED') {
    campos.status = 'CONFIRMED'; // o iFood negou o cancelamento: o pedido segue
  }
  const { data } = await supabase
    .from('pedidos_ifood')
    .update(campos)
    .eq('restaurante_id', restauranteId)
    .eq('ifood_order_id', evento.orderId)
    .select('ifood_order_id');
  return (data ?? []).length > 0;
}

/** Pedidos do iFood das últimas 12 h, mais novos primeiro. */
export async function listarPedidosIfood(restauranteId: string): Promise<PedidoIfoodCozinha[]> {
  const { data, error } = await getSupabase()
    .from('pedidos_ifood')
    .select('ifood_order_id, display_id, status, ultimo_evento, tipo, entrega_por, cliente_nome, total, detalhes, criado_em')
    .eq('restaurante_id', restauranteId)
    .gte('criado_em', new Date(Date.now() - JANELA_LISTA_MS).toISOString())
    .order('criado_em', { ascending: false });

  if (error) {
    throw new Error(`Falha ao listar pedidos do iFood: ${error.message}`);
  }

  return ((data ?? []) as LinhaPedidoIfood[]).map((linha) => ({
    id: linha.ifood_order_id,
    numero: linha.display_id,
    status: linha.status,
    ultimoEvento: linha.ultimo_evento,
    tipo: linha.tipo,
    entregaPor: linha.entrega_por,
    clienteNome: linha.cliente_nome,
    total: linha.total == null ? null : Number(linha.total),
    endereco: linha.detalhes?.delivery?.deliveryAddress?.formattedAddress ?? null,
    observacoes: linha.detalhes?.delivery?.observations ?? null,
    itens: (linha.detalhes?.items ?? []).map((item) => ({
      nome: item.name ?? 'Item',
      quantidade: Number(item.quantity) || 1,
      observacoes: item.observations ?? null,
      opcoes: (item.options ?? []).map((opcao) => `${Number(opcao.quantity) || 1}x ${opcao.name ?? ''}`.trim()),
    })),
    criadoEm: linha.criado_em,
  }));
}

/** Confirmar, avisar que está pronto ou despachar. O evento do iFood confirma depois. */
export async function executarAcaoPedidoIfood(restauranteId: string, ifoodOrderId: string, acao: AcaoPedidoIfood) {
  const pedido = await carregar(restauranteId, ifoodOrderId);
  const { caminho, status, nome } = ENDPOINT_ACAO[acao];
  const accessToken = await obterAccessTokenIfood(restauranteId);
  const resposta = await requisicaoIfood(`/order/v1.0/orders/${pedido.ifood_order_id}/${caminho}`, {
    method: 'POST',
    accessToken,
  });

  if (resposta.status !== 202 && resposta.status !== 200) {
    const detalhe = detalheErro(resposta.body);
    throw new Error(`O iFood não aceitou ${nome} (HTTP ${resposta.status})${detalhe ? `: ${detalhe}` : '.'}`);
  }
  await getSupabase()
    .from('pedidos_ifood')
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq('ifood_order_id', pedido.ifood_order_id);
}

export async function listarMotivosCancelamentoPedidoIfood(restauranteId: string, ifoodOrderId: string) {
  const pedido = await carregar(restauranteId, ifoodOrderId);
  const accessToken = await obterAccessTokenIfood(restauranteId);
  const resposta = await requisicaoIfood<Array<{ cancelCodeId: string; description: string }>>(
    `/order/v1.0/orders/${pedido.ifood_order_id}/cancellationReasons`,
    { accessToken }
  );

  if (resposta.status === 204) {
    return [];
  }
  if (resposta.status !== 200 || !Array.isArray(resposta.body)) {
    throw new Error('Não foi possível buscar os motivos de cancelamento no iFood.');
  }
  return resposta.body.map((motivo) => ({ codigo: String(motivo.cancelCodeId), descricao: motivo.description }));
}

/** Pede o cancelamento; quem cancela de fato é o iFood (evento CANCELLED). */
export async function cancelarPedidoIfood(restauranteId: string, ifoodOrderId: string, codigo: string, descricao: string) {
  const pedido = await carregar(restauranteId, ifoodOrderId);
  const accessToken = await obterAccessTokenIfood(restauranteId);
  const resposta = await requisicaoIfood(`/order/v1.0/orders/${pedido.ifood_order_id}/requestCancellation`, {
    method: 'POST',
    accessToken,
    json: { reason: descricao.slice(0, 250), cancellationCode: String(codigo) },
  });

  if (resposta.status !== 202 && resposta.status !== 200) {
    const detalhe = detalheErro(resposta.body);
    throw new Error(`O iFood não aceitou o cancelamento (HTTP ${resposta.status})${detalhe ? `: ${detalhe}` : '.'}`);
  }
  await getSupabase()
    .from('pedidos_ifood')
    .update({ status: 'CANCELLATION_REQUESTED', atualizado_em: new Date().toISOString() })
    .eq('ifood_order_id', pedido.ifood_order_id);
}
