// utils/ifood-entrega.ts
// "Chamar motoboy iFood" a partir do card da cozinha (iFood Entrega / Shipping,
// pedidos fora da plataforma — salesChannel=POS). Usa a conexão da loja feita
// em /admin/integracoes (utils/ifood.ts).
//
// Fluxo validado contra a API real com a loja de teste (ver
// docs/integracao-ifood-entrega.md):
//   cotação (deliveryAvailabilities) → registro (POST orders) → eventos
//   (polling + acknowledgment) que avançam o status do pedido no goak.
//
// Todo pedido do goak é pago online (PIX/cartão via Mercado Pago), então a
// entrega vai sem `payments`: o motoboy não cobra nada na entrega.

import { randomUUID } from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { atualizarStatusPedidoComNotificacoes } from '@/utils/pedidos-acompanhamento';
import { type DadosClientePedido, type StatusPedido, obterTipoEntregaPedido } from '@/utils/pedido-status';
import {
  obterAccessTokenIfood,
  obterIntegracaoIfoodPorRestauranteId,
  requisicaoIfood,
} from '@/utils/ifood';

export interface CotacaoIfood {
  id: string;
  valor: number;
  distanciaMetros: number;
  tempoMinimoMin: number;
  tempoMaximoMin: number;
  expiraEm: string | null;
}

export interface MotivoCancelamentoIfood {
  codigo: string;
  descricao: string;
}

interface PedidoParaIfood {
  id: string;
  restaurante_id: string;
  numero_pedido: number | null;
  status: StatusPedido;
  valor_total: number | string;
  dados_cliente: DadosClientePedido | null;
  cliente_latitude: number | null;
  cliente_longitude: number | null;
  tempo_preparo_estimado_min: number | null;
  created_at: string;
  logistica: string | null;
  ifood_order_id: string | null;
  ifood_alteracao_endereco: { estado?: string } | null;
  itens_pedido: Array<{
    id: string;
    quantidade: number;
    preco_unitario: number;
    itens_cardapio: { nome: string } | Array<{ nome: string }> | null;
    itens_pedido_complementos: Array<{ preco_adicional: number | null }> | null;
  }> | null;
}

// Ordem da esteira do goak: eventos do iFood só fazem o pedido avançar.
const ORDEM_STATUS: StatusPedido[] = ['PENDENTE', 'PAGO', 'PREPARANDO', 'PRONTO', 'SAIU_PARA_ENTREGA', 'ENTREGUE'];

// Erros de cotação/registro documentados pelo iFood → mensagem pra cozinha.
const MENSAGENS_ERRO_IFOOD: Record<string, string> = {
  DeliveryDistanceTooHigh: 'Endereço do cliente fica longe demais da loja para o iFood Entrega (cerca de 10 km).',
  OffOpeningHours: 'Fora do horário de operação do iFood Entrega.',
  ServiceAreaMismatch: 'O iFood Entrega não atende o endereço do cliente.',
  OriginNotFound: 'A loja não está numa área atendida pelo iFood Entrega.',
  HighDemand: 'Muita demanda no iFood Entrega agora. Tente de novo em alguns minutos.',
  UnavailableFleet: 'Sem entregadores disponíveis no iFood agora. Tente de novo em alguns minutos.',
  NRELimitExceeded: 'Limite de entregas simultâneas do iFood atingido. Aguarde alguma terminar.',
  BadRequestMerchant: 'A loja está indisponível no iFood. Confira o status no Portal do Parceiro.',
  MerchantEasyDeliveryDisabled: 'O iFood Entrega não está habilitado para esta loja.',
  MerchantStatusAvailability: 'A conta da loja no iFood tem pendências. Fale com o suporte do iFood.',
  BadRequestCustomer: 'Nome ou telefone do cliente inválido para o iFood.',
};

const SELECT_PEDIDO = `
  id, restaurante_id, numero_pedido, status, valor_total, dados_cliente, cliente_latitude, cliente_longitude,
  tempo_preparo_estimado_min, created_at, logistica, ifood_order_id, ifood_alteracao_endereco,
  itens_pedido ( id, quantidade, preco_unitario, itens_cardapio ( nome ), itens_pedido_complementos ( preco_adicional ) )
`;

function getSupabase() {
  return createWebhookAdminClient();
}

function mensagemErroIfood(body: unknown, padrao: string) {
  const erro = (body ?? {}) as { code?: string; message?: string; error?: { code?: string; message?: string } };
  const codigo = erro.code ?? erro.error?.code;
  if (codigo && MENSAGENS_ERRO_IFOOD[codigo]) {
    return MENSAGENS_ERRO_IFOOD[codigo];
  }
  const detalhe = erro.message ?? erro.error?.message;
  return detalhe ? `${padrao} (${detalhe})` : padrao;
}

async function carregarPedido(restauranteId: string, pedidoId: string): Promise<PedidoParaIfood> {
  const { data, error } = await getSupabase()
    .from('pedidos')
    .select(SELECT_PEDIDO)
    .eq('id', pedidoId)
    .eq('restaurante_id', restauranteId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Pedido não encontrado.');
  }
  return data as unknown as PedidoParaIfood;
}

async function lojaConectada(restauranteId: string) {
  const integracao = await obterIntegracaoIfoodPorRestauranteId(restauranteId);
  if (!integracao?.merchant_id || integracao.connection_status !== 'conectado') {
    throw new Error('Conecte a loja do iFood em Integrações antes de chamar um entregador.');
  }
  const accessToken = await obterAccessTokenIfood(restauranteId);
  return { accessToken, merchantId: integracao.merchant_id, estadoLoja: integracao.merchant_endereco?.estado ?? null };
}

function exigirIfood(pedido: PedidoParaIfood) {
  if (pedido.logistica !== 'IFOOD' || !pedido.ifood_order_id) {
    throw new Error('Este pedido não está com entrega pelo iFood.');
  }
  return pedido.ifood_order_id;
}

/** UF pelo CEP (ViaCEP → BrasilAPI); sem resposta, usa o estado da loja no iFood. */
async function obterUf(cep: string | undefined, estadoLoja: string | null) {
  const digitos = String(cep ?? '').replace(/\D/g, '');
  if (digitos.length === 8) {
    for (const url of [`https://viacep.com.br/ws/${digitos}/json/`, `https://brasilapi.com.br/api/cep/v2/${digitos}`]) {
      try {
        const resposta = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (resposta.ok) {
          const dados = (await resposta.json()) as { uf?: string; state?: string; erro?: boolean };
          const uf = dados.uf ?? dados.state;
          if (!dados.erro && uf && /^[A-Z]{2}$/.test(uf)) return uf;
        }
      } catch {
        // tenta o próximo provedor
      }
    }
  }
  return estadoLoja;
}

// ------------------------------------------------------------ cotação e registro

export async function cotarEntregaIfood(restauranteId: string, pedidoId: string): Promise<CotacaoIfood> {
  const pedido = await carregarPedido(restauranteId, pedidoId);
  if (obterTipoEntregaPedido(pedido.dados_cliente) !== 'ENTREGA') {
    throw new Error('Pedido de retirada não precisa de entregador.');
  }
  if (pedido.logistica === 'IFOOD') {
    throw new Error('Este pedido já está com entrega pelo iFood.');
  }
  if (typeof pedido.cliente_latitude !== 'number' || typeof pedido.cliente_longitude !== 'number') {
    throw new Error('O pedido não tem a localização do cliente (latitude/longitude) para cotar a entrega.');
  }

  const { accessToken, merchantId } = await lojaConectada(restauranteId);
  const resposta = await requisicaoIfood<{
    id: string;
    expirationAt?: string;
    distance?: number;
    quote?: { netValue?: number };
    deliveryTime?: { min?: number; max?: number };
  }>(`/shipping/v1.0/merchants/${merchantId}/deliveryAvailabilities`, {
    accessToken,
    query: { latitude: pedido.cliente_latitude, longitude: pedido.cliente_longitude },
  });

  if (resposta.status !== 200 || !resposta.body?.id) {
    throw new Error(mensagemErroIfood(resposta.body, 'O iFood não tem entregador disponível para este endereço.'));
  }

  const cotacao = resposta.body;
  return {
    id: cotacao.id,
    valor: Number(cotacao.quote?.netValue ?? 0),
    distanciaMetros: Number(cotacao.distance ?? 0),
    tempoMinimoMin: Math.round(Number(cotacao.deliveryTime?.min ?? 0) / 60),
    tempoMaximoMin: Math.round(Number(cotacao.deliveryTime?.max ?? 0) / 60),
    expiraEm: cotacao.expirationAt ?? null,
  };
}

export async function chamarEntregadorIfood(restauranteId: string, pedidoId: string, cotacao: CotacaoIfood) {
  const pedido = await carregarPedido(restauranteId, pedidoId);
  if (pedido.logistica === 'IFOOD') {
    throw new Error('Este pedido já está com entrega pelo iFood.');
  }
  if (!['PAGO', 'PREPARANDO', 'PRONTO'].includes(pedido.status)) {
    throw new Error('Só dá para chamar o entregador com o pedido pago, em preparo ou pronto.');
  }

  const cliente = pedido.dados_cliente ?? { nome: '', telefone: '' };
  const endereco = cliente.endereco ?? {};
  const { accessToken, merchantId, estadoLoja } = await lojaConectada(restauranteId);
  const uf = await obterUf(endereco.cep, estadoLoja);
  if (!uf) {
    throw new Error('Não foi possível identificar o estado (UF) do endereço do cliente.');
  }

  const telefone = String(cliente.telefone ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  const itens = (pedido.itens_pedido ?? []).map((item) => {
    const nome = (Array.isArray(item.itens_cardapio) ? item.itens_cardapio[0]?.nome : item.itens_cardapio?.nome) ?? 'Item';
    const quantidade = Number(item.quantidade) || 1;
    const unitario = Number(item.preco_unitario) || 0;
    const preco = Math.round(unitario * quantidade * 100) / 100;
    const adicionais = (item.itens_pedido_complementos ?? []).reduce((soma, c) => soma + Number(c.preco_adicional ?? 0), 0);
    const precoAdicionais = Math.round(adicionais * quantidade * 100) / 100;
    return {
      id: randomUUID(),
      name: nome.slice(0, 50),
      quantity: quantidade,
      unitPrice: unitario,
      price: preco,
      optionsPrice: precoAdicionais,
      totalPrice: Math.round((preco + precoAdicionais) * 100) / 100,
    };
  });

  // Taxa de entrega que o CLIENTE pagou à loja (o goak não guarda à parte:
  // é o total menos os itens, como em app/api/checkout/retomar). Vai em
  // merchantFee só como informação — aparece na página de acompanhamento do
  // iFood. Não é o que o iFood cobra da loja pelo entregador (isso é a cotação).
  const totalItens = itens.reduce((soma, item) => soma + item.totalPrice, 0);
  const taxaEntregaCliente = Math.max(0, Math.round((Number(pedido.valor_total) - totalItens) * 100) / 100);

  // Tempo de preparo restante, em segundos: o iFood aloca o entregador pra
  // chegar quando o pedido estiver pronto. Pronto → aloca já.
  let preparoSegundos = 0;
  if (pedido.status !== 'PRONTO' && pedido.tempo_preparo_estimado_min) {
    const decorrido = (Date.now() - new Date(pedido.created_at).getTime()) / 1000;
    preparoSegundos = Math.max(0, Math.round(pedido.tempo_preparo_estimado_min * 60 - decorrido));
  }

  const payload = {
    displayId: pedido.numero_pedido ? String(pedido.numero_pedido).slice(-4) : undefined,
    customer: {
      name: (cliente.nome || 'Cliente').slice(0, 50),
      phone: { countryCode: '55', areaCode: telefone.slice(0, 2), number: telefone.slice(2), type: 'CUSTOMER' },
    },
    delivery: {
      merchantFee: taxaEntregaCliente,
      quoteId: cotacao.id,
      preparationTime: preparoSegundos,
      deliveryAddress: {
        postalCode: String(endereco.cep ?? '').replace(/\D/g, ''),
        streetNumber: endereco.numero || 'S/N',
        streetName: (endereco.rua || '').slice(0, 50),
        neighborhood: (endereco.bairro || '').slice(0, 50),
        city: (endereco.cidade || '').slice(0, 50),
        state: uf,
        country: 'BR',
        coordinates: { latitude: pedido.cliente_latitude, longitude: pedido.cliente_longitude },
      },
      ...(cliente.observacoes ? { observations: cliente.observacoes.slice(0, 70) } : {}),
    },
    items: itens,
  };

  const resposta = await requisicaoIfood<{ id: string; trackingUrl?: string }>(
    `/shipping/v1.0/merchants/${merchantId}/orders`,
    { method: 'POST', accessToken, json: payload }
  );

  if (resposta.status !== 202 || !resposta.body?.id) {
    throw new Error(mensagemErroIfood(resposta.body, 'O iFood recusou o pedido de entrega.'));
  }

  const { error } = await getSupabase()
    .from('pedidos')
    .update({
      logistica: 'IFOOD',
      entregador_id: null,
      ifood_order_id: resposta.body.id,
      ifood_tracking_url: resposta.body.trackingUrl ?? null,
      ifood_status: 'REGISTRADO',
      ifood_cotacao: cotacao,
      ifood_entregador: null,
      ifood_alteracao_endereco: null,
      ifood_codigo_entrega: null,
      ifood_atualizado_em: new Date().toISOString(),
    })
    .eq('id', pedidoId);

  if (error) {
    // O iFood já registrou a entrega: não dá pra perder o ID dela.
    console.error('Entrega iFood registrada mas não salva no pedido:', { pedidoId, ifoodOrderId: resposta.body.id, error });
    throw new Error(`Entrega registrada no iFood (${resposta.body.id}), mas houve falha ao salvar no pedido.`);
  }

  return { ifoodOrderId: resposta.body.id, trackingUrl: resposta.body.trackingUrl ?? null };
}

// ------------------------------------------------------------ ações durante a entrega

export async function listarMotivosCancelamentoIfood(restauranteId: string, pedidoId: string): Promise<MotivoCancelamentoIfood[]> {
  const ifoodOrderId = exigirIfood(await carregarPedido(restauranteId, pedidoId));
  const { accessToken } = await lojaConectada(restauranteId);
  const resposta = await requisicaoIfood<Array<{ cancelCodeId: string; description: string }>>(
    `/shipping/v1.0/orders/${ifoodOrderId}/cancellationReasons`,
    { accessToken }
  );

  if (resposta.status === 204) {
    return [];
  }
  if (resposta.status !== 200 || !Array.isArray(resposta.body)) {
    throw new Error(mensagemErroIfood(resposta.body, 'Não foi possível buscar os motivos de cancelamento no iFood.'));
  }
  return resposta.body.map((motivo) => ({ codigo: String(motivo.cancelCodeId), descricao: motivo.description }));
}

export async function cancelarEntregaIfood(restauranteId: string, pedidoId: string, codigo: string, descricao: string) {
  const ifoodOrderId = exigirIfood(await carregarPedido(restauranteId, pedidoId));
  const { accessToken } = await lojaConectada(restauranteId);
  // cancellationCode vai como string: a doc diz integer, mas a API recusa número.
  const resposta = await requisicaoIfood(`/shipping/v1.0/orders/${ifoodOrderId}/cancel`, {
    method: 'POST',
    accessToken,
    json: { reason: descricao.slice(0, 250), cancellationCode: String(codigo) },
  });

  if (resposta.status !== 202 && resposta.status !== 200) {
    throw new Error(mensagemErroIfood(resposta.body, 'O iFood não aceitou o cancelamento.'));
  }
  // A confirmação chega pelo evento CANCELLED (ou CANCELLATION_REQUEST_FAILED).
  await getSupabase()
    .from('pedidos')
    .update({ ifood_status: 'CANCELAMENTO_SOLICITADO', ifood_atualizado_em: new Date().toISOString() })
    .eq('id', pedidoId);
}

export async function responderAlteracaoEnderecoIfood(restauranteId: string, pedidoId: string, aceitar: boolean) {
  const pedido = await carregarPedido(restauranteId, pedidoId);
  const ifoodOrderId = exigirIfood(pedido);
  if (pedido.ifood_alteracao_endereco?.estado !== 'PENDENTE') {
    throw new Error('Não há pedido de alteração de endereço aguardando resposta.');
  }

  const { accessToken } = await lojaConectada(restauranteId);
  const acao = aceitar ? 'acceptDeliveryAddressChange' : 'denyDeliveryAddressChange';
  const resposta = await requisicaoIfood(`/shipping/v1.0/orders/${ifoodOrderId}/${acao}`, { method: 'POST', accessToken });

  if (resposta.status !== 200 && resposta.status !== 202) {
    throw new Error(mensagemErroIfood(resposta.body, 'O iFood não aceitou a resposta sobre o endereço.'));
  }
  await getSupabase()
    .from('pedidos')
    .update({
      ifood_alteracao_endereco: { ...pedido.ifood_alteracao_endereco, estado: aceitar ? 'ACEITANDO' : 'REJEITANDO' },
      ifood_atualizado_em: new Date().toISOString(),
    })
    .eq('id', pedidoId);
}

/** O entregador informa o código na loja; só entregue o pedido se for válido. */
export async function validarCodigoColetaIfood(restauranteId: string, pedidoId: string, codigo: string) {
  const ifoodOrderId = exigirIfood(await carregarPedido(restauranteId, pedidoId));
  const { accessToken } = await lojaConectada(restauranteId);
  const resposta = await requisicaoIfood<{ valid?: boolean }>(`/order/v1.0/orders/${ifoodOrderId}/validatePickupCode`, {
    method: 'POST',
    accessToken,
    json: { code: codigo.trim() },
  });

  if (resposta.status === 412) {
    throw new Error('O iFood ainda não liberou a validação: aguarde o entregador chegar à loja.');
  }
  if (resposta.status !== 200) {
    throw new Error(mensagemErroIfood(resposta.body, 'Não foi possível validar o código no iFood.'));
  }
  return resposta.body?.valid === true;
}

// ------------------------------------------------------------ eventos

interface EventoIfood {
  id: string;
  code?: string;
  fullCode?: string;
  orderId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Polling dos eventos da loja (chamado pela cozinha a cada 30s): grava cada
 * evento uma vez só (event_id é a chave), aplica no pedido e confirma
 * (acknowledgment) tudo que recebeu, inclusive duplicados.
 */
export async function processarEventosIfood(restauranteId: string) {
  const integracao = await obterIntegracaoIfoodPorRestauranteId(restauranteId);
  if (!integracao?.merchant_id || integracao.connection_status !== 'conectado') {
    return { conectado: false, novos: 0 };
  }

  const accessToken = await obterAccessTokenIfood(restauranteId);
  const resposta = await requisicaoIfood<EventoIfood[]>('/events/v1.0/events:polling', {
    accessToken,
    query: { categories: 'ALL' },
    headers: { 'x-polling-merchants': integracao.merchant_id },
  });

  if (resposta.status === 204 || !Array.isArray(resposta.body) || resposta.body.length === 0) {
    if (resposta.status !== 204 && resposta.status !== 200) {
      console.error('Falha no polling de eventos do iFood:', resposta.status, resposta.texto.slice(0, 300));
    }
    return { conectado: true, novos: 0 };
  }

  const supabase = getSupabase();
  let novos = 0;

  for (const evento of resposta.body) {
    const { data: pedido } = evento.orderId
      ? await supabase
          .from('pedidos')
          .select('id, status, ifood_alteracao_endereco')
          .eq('restaurante_id', restauranteId)
          .eq('ifood_order_id', evento.orderId)
          .maybeSingle()
      : { data: null };

    const { error: duplicado } = await supabase.from('eventos_ifood').insert({
      event_id: evento.id,
      restaurante_id: restauranteId,
      ifood_order_id: evento.orderId ?? null,
      pedido_id: pedido?.id ?? null,
      codigo: evento.fullCode ?? evento.code ?? null,
      payload: evento,
    });

    if (duplicado) {
      continue; // já processado (chave primária) — só confirma de novo no acknowledgment
    }
    novos += 1;

    if (pedido) {
      try {
        await aplicarEvento(pedido as { id: string; status: StatusPedido; ifood_alteracao_endereco: Record<string, unknown> | null }, evento);
      } catch (erro) {
        console.error('Falha ao aplicar evento do iFood no pedido:', { eventId: evento.id, pedidoId: pedido.id, erro });
      }
    }
  }

  const ack = await requisicaoIfood('/events/v1.0/events/acknowledgment', {
    method: 'POST',
    accessToken,
    json: resposta.body.map((evento) => ({ id: evento.id })),
  });
  if (ack.status !== 202 && ack.status !== 200) {
    console.error('Falha no acknowledgment de eventos do iFood:', ack.status, ack.texto.slice(0, 300));
  }

  return { conectado: true, novos };
}

async function avancarStatus(pedido: { id: string; status: StatusPedido }, destino: StatusPedido) {
  if (pedido.status === 'CANCELADO') return;
  if (ORDEM_STATUS.indexOf(destino) <= ORDEM_STATUS.indexOf(pedido.status)) return;
  await atualizarStatusPedidoComNotificacoes({ pedidoId: pedido.id, novoStatus: destino });
}

async function aplicarEvento(
  pedido: { id: string; status: StatusPedido; ifood_alteracao_endereco: Record<string, unknown> | null },
  evento: EventoIfood
) {
  const codigo = evento.fullCode ?? evento.code ?? '';
  const metadata = evento.metadata ?? {};
  const campos: Record<string, unknown> = { ifood_status: codigo, ifood_atualizado_em: new Date().toISOString() };

  switch (codigo) {
    case 'ASSIGN_DRIVER':
      campos.ifood_entregador = {
        nome: metadata.workerName ?? null,
        telefone: metadata.workerPhone ?? null,
        veiculo: metadata.workerVehicleType ?? null,
        foto: metadata.workerPhotoUrl ?? null,
      };
      break;
    case 'DELIVERY_DROP_CODE_REQUESTED':
      // Código que o entregador pede ao cliente na entrega.
      campos.ifood_codigo_entrega = typeof metadata.CODE === 'string' ? metadata.CODE : null;
      break;
    case 'DELIVERY_ADDRESS_CHANGE_REQUESTED':
      campos.ifood_alteracao_endereco = {
        estado: 'PENDENTE',
        solicitadoEm: evento.createdAt ?? new Date().toISOString(),
        endereco: metadata.address ?? null,
      };
      break;
    case 'DELIVERY_ADDRESS_CHANGE_ACCEPTED':
    case 'DELIVERY_ADDRESS_CHANGE_DENIED':
    case 'DELIVERY_ADDRESS_CHANGE_USER_CONFIRMED':
      campos.ifood_alteracao_endereco = {
        ...(pedido.ifood_alteracao_endereco ?? {}),
        estado: codigo.replace('DELIVERY_ADDRESS_CHANGE_', ''),
      };
      break;
    case 'CANCELLED':
    case 'DELIVERY_CANCELLED':
      // Entrega cancelada no iFood (pela loja, pelo iFood ou por falta de
      // entregador): libera o pedido pra motoboy próprio. O pedido em si
      // continua — quem decide cancelar a venda é a cozinha.
      campos.logistica = null;
      break;
  }

  await getSupabase().from('pedidos').update(campos).eq('id', pedido.id);

  if (['DISPATCHED', 'COLLECTED', 'DELIVERY_IN_TRANSIT'].includes(codigo)) {
    await avancarStatus(pedido, 'SAIU_PARA_ENTREGA');
  } else if (['CONCLUDED', 'DELIVERY_CONCLUDED'].includes(codigo)) {
    await avancarStatus(pedido, 'ENTREGUE');
  }
}

// ------------------------------------------------------------ taxa no checkout

export interface TaxaEntregaIfoodCheckout {
  /** O que o cliente paga de entrega: cotação do iFood + acréscimo da loja. */
  taxaCliente: number;
  cotacao: CotacaoIfood;
  acrescimo: number;
}

/** A loja ligou "Entregas pelo iFood" (e está conectada)? Não chama o iFood. */
export async function lojaEntregaPeloIfood(restauranteId: string) {
  const integracao = await obterIntegracaoIfoodPorRestauranteId(restauranteId).catch(() => null);
  return Boolean(integracao?.merchant_id && integracao.connection_status === 'conectado' && integracao.entregas_pelo_ifood);
}

/**
 * Taxa de entrega do checkout quando a loja entrega pelo iFood. Devolve null
 * (e o checkout usa a taxa normal da loja) se a opção estiver desligada ou se
 * o iFood não atender o endereço agora (fora de área/horário, sem frota).
 */
export async function cotarTaxaEntregaIfoodCheckout(
  restauranteId: string,
  coordenada: { latitude: number; longitude: number }
): Promise<TaxaEntregaIfoodCheckout | null> {
  try {
    const integracao = await obterIntegracaoIfoodPorRestauranteId(restauranteId);
    if (!integracao?.merchant_id || integracao.connection_status !== 'conectado' || !integracao.entregas_pelo_ifood) {
      return null;
    }

    const accessToken = await obterAccessTokenIfood(restauranteId);
    const resposta = await requisicaoIfood<{
      id: string;
      expirationAt?: string;
      distance?: number;
      quote?: { netValue?: number };
      deliveryTime?: { min?: number; max?: number };
    }>(`/shipping/v1.0/merchants/${integracao.merchant_id}/deliveryAvailabilities`, {
      accessToken,
      query: { latitude: coordenada.latitude, longitude: coordenada.longitude },
    });

    if (resposta.status !== 200 || !resposta.body?.id) {
      console.warn('iFood não atende a entrega no checkout (usando taxa da loja):', resposta.status, resposta.texto.slice(0, 200));
      return null;
    }

    const cotacao: CotacaoIfood = {
      id: resposta.body.id,
      valor: Number(resposta.body.quote?.netValue ?? 0),
      distanciaMetros: Number(resposta.body.distance ?? 0),
      tempoMinimoMin: Math.round(Number(resposta.body.deliveryTime?.min ?? 0) / 60),
      tempoMaximoMin: Math.round(Number(resposta.body.deliveryTime?.max ?? 0) / 60),
      expiraEm: resposta.body.expirationAt ?? null,
    };
    const acrescimo = Number(integracao.acrescimo_taxa_entrega ?? 0);
    return { cotacao, acrescimo, taxaCliente: Math.round((cotacao.valor + acrescimo) * 100) / 100 };
  } catch (erro) {
    console.error('Falha ao cotar a entrega no iFood durante o checkout (usando taxa da loja):', erro);
    return null;
  }
}
