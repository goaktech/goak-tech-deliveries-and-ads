import { randomUUID } from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { enviarNotificacoesStatusPedido, type PedidoParaNotificacao } from '@/utils/notificacoes-pedido';
import { calcularRotaEntrega } from '@/utils/google-maps';
import {
  type DadosClientePedido,
  type StatusPedido,
  ehStatusPedidoTerminal,
  formatarEnderecoPedido,
  obterTipoEntregaPedido,
} from '@/utils/pedido-status';


export interface AdicionalPedidoInput {
  id: string;
  nome: string;
  preco_adicional: number;
}

interface ItemPedidoInput {
  item_cardapio_id: string;
  quantidade: number;
  preco_unitario: number;
  adicionais?: AdicionalPedidoInput[];
}

interface AdicionalPedidoBruto {
  id: string;
  nome: string;
  preco_adicional: number;
}

interface PedidoPublicoLinhaBruta {
  id: string;
  quantidade: number;
  preco_unitario: number;
  itens_cardapio: {
    nome: string;
    imagem_url?: string | null;
  } | null;
  itens_pedido_complementos: AdicionalPedidoBruto[] | null;
}

interface RestauranteRelacionadoBruto {
  nome: string;
  slug: string;
  endereco?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface PedidoPublicoBruto {
  id: string;
  status: StatusPedido;
  valor_total: number;
  forma_pagamento: string;
  dados_cliente: DadosClientePedido;
  created_at: string;
  updated_at: string;
  codigo_acompanhamento: string;
  codigo_confirmacao_entrega: string;
  mercado_pago_payment_id?: string | null;
  cliente_latitude?: number | null;
  cliente_longitude?: number | null;
  distancia_entrega_km?: number | null;
  tempo_deslocamento_min?: number | null;
  tempo_preparo_estimado_min?: number | null;
  numero_pedido?: number | null;
  motivo_cancelamento?: string | null;
  cancelado_em?: string | null;
  restaurantes: RestauranteRelacionadoBruto | RestauranteRelacionadoBruto[] | null;
  itens_pedido: PedidoPublicoLinhaBruta[] | null;
}

type PedidoInternoBruto = PedidoPublicoBruto & { restaurante_id: string };

export interface PedidoPublico {
  id: string;
  status: StatusPedido;
  valor_total: number;
  forma_pagamento: string;
  created_at: string;
  updated_at: string;
  codigo_acompanhamento: string;
  codigo_confirmacao_entrega: string;
  mercado_pago_payment_id: string | null;
  dados_cliente: DadosClientePedido;
  endereco_entrega: string | null;
  distancia_entrega_km: number | null;
  tempo_deslocamento_min: number | null;
  tempo_preparo_estimado_min: number | null;
  numero_pedido: number | null;
  motivo_cancelamento: string | null;
  cancelado_em: string | null;
  restaurante: {
    nome: string;
    slug: string;
    endereco: string | null;
  };
  itens: Array<{
    id: string;
    nome: string;
    imagem_url: string | null;
    quantidade: number;
    preco_unitario: number;
    adicionais: Array<{ id: string; nome: string; preco_adicional: number }>;
  }>;
}

function getSupabase() {
  return createWebhookAdminClient();
}

async function upsertClientePorTelefone(restauranteId: string, dadosCliente: DadosClientePedido) {
  const telefoneNormalizado = dadosCliente.telefone?.replace(/\D/g, '');
  if (!telefoneNormalizado) {
    return;
  }

  const supabase = getSupabase();

  try {
    const { data: existente } = await supabase
      .from('public_clientes')
      .select('nome, email, endereco')
      .eq('restaurante_id', restauranteId)
      .eq('telefone', telefoneNormalizado)
      .maybeSingle();

    const { error } = await supabase.from('public_clientes').upsert(
      {
        restaurante_id: restauranteId,
        telefone: telefoneNormalizado,
        nome: dadosCliente.nome || existente?.nome || '',
        email: dadosCliente.email || existente?.email || null,
        endereco: dadosCliente.endereco ?? existente?.endereco ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'restaurante_id,telefone' }
    );

    if (error) {
      console.error('Falha ao salvar cadastro de cliente:', error);
    }
  } catch (error) {
    console.error('Falha ao processar cadastro de cliente:', error);
  }
}

export function gerarCodigoAcompanhamentoPedido() {
  return randomUUID().replace(/-/g, '');
}

export function gerarCodigoConfirmacaoEntrega() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function gerarExternalReferencePedido(restauranteId: string, codigoAcompanhamento: string) {
  return `pedido_${restauranteId}_${codigoAcompanhamento}`;
}

function normalizarPedidoPublico(bruto: PedidoPublicoBruto): PedidoPublico {
  const restaurante = Array.isArray(bruto.restaurantes) ? bruto.restaurantes[0] : bruto.restaurantes;

  return {
    id: bruto.id,
    status: bruto.status,
    valor_total: Number(bruto.valor_total),
    forma_pagamento: bruto.forma_pagamento,
    created_at: bruto.created_at,
    updated_at: bruto.updated_at,
    codigo_acompanhamento: bruto.codigo_acompanhamento,
    codigo_confirmacao_entrega: bruto.codigo_confirmacao_entrega,
    mercado_pago_payment_id: bruto.mercado_pago_payment_id ?? null,
    dados_cliente: bruto.dados_cliente,
    endereco_entrega: formatarEnderecoPedido(bruto.dados_cliente),
    distancia_entrega_km: bruto.distancia_entrega_km != null ? Number(bruto.distancia_entrega_km) : null,
    tempo_deslocamento_min: bruto.tempo_deslocamento_min != null ? Number(bruto.tempo_deslocamento_min) : null,
    tempo_preparo_estimado_min:
      bruto.tempo_preparo_estimado_min != null ? Number(bruto.tempo_preparo_estimado_min) : null,
    numero_pedido: bruto.numero_pedido != null ? Number(bruto.numero_pedido) : null,
    motivo_cancelamento: bruto.motivo_cancelamento ?? null,
    cancelado_em: bruto.cancelado_em ?? null,
    restaurante: {
      nome: restaurante?.nome ?? 'Restaurante',
      slug: restaurante?.slug ?? '',
      endereco: restaurante?.endereco ?? null,
    },
    itens: (bruto.itens_pedido ?? []).map((item) => ({
      id: item.id,
      nome: item.itens_cardapio?.nome ?? 'Item',
      imagem_url: item.itens_cardapio?.imagem_url ?? null,
      quantidade: Number(item.quantidade),
      preco_unitario: Number(item.preco_unitario),
      adicionais: (item.itens_pedido_complementos ?? []).map((adicional) => ({
        id: adicional.id,
        nome: adicional.nome,
        preco_adicional: Number(adicional.preco_adicional),
      })),
    })),
  };
}

export async function criarPedidoPendente(params: {
  restauranteId: string;
  formaPagamento: string;
  dadosCliente: DadosClientePedido;
  itens: ItemPedidoInput[];
  valorTotal: number;
  externalReference: string;
  clienteLatitude?: number | null;
  clienteLongitude?: number | null;
  distanciaEntregaKm?: number | null;
  tempoDeslocamentoMin?: number | null;
  tempoPreparoEstimadoMin?: number | null;
}) {
  const supabase = getSupabase();
  const codigoAcompanhamento = gerarCodigoAcompanhamentoPedido();
  const codigoConfirmacaoEntrega = gerarCodigoConfirmacaoEntrega();
  const agora = new Date().toISOString();

  const { data: pedido, error: errPedido } = await supabase
    .from('pedidos')
    .insert([
      {
        restaurante_id: params.restauranteId,
        status: 'PENDENTE',
        valor_total: Math.round(params.valorTotal * 100) / 100,
        forma_pagamento: params.formaPagamento,
        dados_cliente: params.dadosCliente,
        codigo_acompanhamento: codigoAcompanhamento,
        codigo_confirmacao_entrega: codigoConfirmacaoEntrega,
        mercado_pago_external_reference: params.externalReference,
        cliente_latitude: params.clienteLatitude ?? null,
        cliente_longitude: params.clienteLongitude ?? null,
        distancia_entrega_km: params.distanciaEntregaKm ?? null,
        tempo_deslocamento_min: params.tempoDeslocamentoMin ?? null,
        tempo_preparo_estimado_min: params.tempoPreparoEstimadoMin ?? null,
        updated_at: agora,
      },
    ])
    .select('id, codigo_acompanhamento, mercado_pago_external_reference')
    .single();

  if (errPedido || !pedido) {
    throw errPedido || new Error('Falha ao criar pedido pendente.');
  }

  const linhasItens = params.itens.map((item) => ({
    pedido_id: pedido.id,
    item_cardapio_id: item.item_cardapio_id,
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
  }));

  const { data: itensInseridos, error: errItens } = await supabase
    .from('itens_pedido')
    .insert(linhasItens)
    .select('id');

  if (errItens || !itensInseridos) {
    await supabase.from('pedidos').delete().eq('id', pedido.id);
    throw errItens || new Error('Falha ao registrar itens do pedido.');
  }

  const linhasAdicionais = itensInseridos.flatMap((itemInserido, indice) => {
    const adicionaisDoItem = params.itens[indice]?.adicionais ?? [];
    return adicionaisDoItem.map((adicional) => ({
      item_pedido_id: itemInserido.id,
      complemento_produto_id: adicional.id,
      nome: adicional.nome,
      preco_adicional: adicional.preco_adicional,
    }));
  });

  if (linhasAdicionais.length > 0) {
    const { error: errAdicionais } = await supabase
      .from('itens_pedido_complementos')
      .insert(linhasAdicionais);

    if (errAdicionais) {
      await supabase.from('pedidos').delete().eq('id', pedido.id);
      throw errAdicionais;
    }
  }

  await upsertClientePorTelefone(params.restauranteId, params.dadosCliente);

  return {
    id: pedido.id,
    codigoAcompanhamento: pedido.codigo_acompanhamento as string,
    externalReference: pedido.mercado_pago_external_reference as string,
  };
}

export async function buscarPedidoPublicoPorToken(slug: string, token: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id,
      status,
      valor_total,
      forma_pagamento,
      dados_cliente,
      created_at,
      updated_at,
      codigo_acompanhamento,
      codigo_confirmacao_entrega,
      mercado_pago_payment_id,
      cliente_latitude,
      cliente_longitude,
      distancia_entrega_km,
      tempo_deslocamento_min,
      tempo_preparo_estimado_min,
      numero_pedido,
      motivo_cancelamento,
      cancelado_em,
      restaurantes ( nome, slug, endereco, latitude, longitude ),
      itens_pedido ( id, quantidade, preco_unitario, itens_cardapio ( nome, imagem_url ), itens_pedido_complementos ( id, nome, preco_adicional ) )
    `)
    .eq('codigo_acompanhamento', token)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const pedido = normalizarPedidoPublico(data as unknown as PedidoPublicoBruto);
  if (pedido.restaurante.slug !== slug) {
    return null;
  }

  return pedido;
}

export async function buscarPedidoInternoPorId(pedidoId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id,
      status,
      valor_total,
      forma_pagamento,
      dados_cliente,
      created_at,
      updated_at,
      codigo_acompanhamento,
      mercado_pago_payment_id,
      restaurante_id,
      cliente_latitude,
      cliente_longitude,
      distancia_entrega_km,
      tempo_deslocamento_min,
      tempo_preparo_estimado_min,
      numero_pedido,
      motivo_cancelamento,
      cancelado_em,
      restaurantes ( nome, slug, endereco, latitude, longitude ),
      itens_pedido ( id, quantidade, preco_unitario, item_cardapio_id, itens_cardapio ( nome, imagem_url ), itens_pedido_complementos ( id, nome, preco_adicional ) )
    `)
    .eq('id', pedidoId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as unknown as PedidoInternoBruto;
}

export async function buscarPedidoPorExternalReference(externalReference: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, status, mercado_pago_payment_id, restaurante_id, codigo_acompanhamento')
    .eq('mercado_pago_external_reference', externalReference)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as {
    id: string;
    status: StatusPedido;
    mercado_pago_payment_id?: string | null;
    restaurante_id: string;
    codigo_acompanhamento: string;
  };
}

async function processarEfeitosColateraisPagamentoAprovado(pedidoId: string, restauranteId: string) {
  const supabase = getSupabase();
  const { data: itensPedido, error: errItensPedido } = await supabase
    .from('itens_pedido')
    .select('item_cardapio_id, quantidade')
    .eq('pedido_id', pedidoId);

  if (errItensPedido) {
    throw errItensPedido;
  }

  const idsProdutos = (itensPedido ?? []).map((item) => item.item_cardapio_id as string);
  if (idsProdutos.length === 0) {
    return;
  }

  const { data: composicoes, error: errCompo } = await supabase
    .from('composicao_produto')
    .select('item_cardapio_id, insumo_id, quantidade_necessaria')
    .in('item_cardapio_id', idsProdutos);

  if (errCompo) {
    throw new Error(`Falha ao carregar composição dos produtos: ${errCompo.message}`);
  }

  const quantidadePorItem = new Map(
    (itensPedido ?? []).map((item) => [String(item.item_cardapio_id), Number(item.quantidade)])
  );

  for (const comp of composicoes ?? []) {
    const qtdVendidaDoProduto = quantidadePorItem.get(String(comp.item_cardapio_id)) || 0;
    const quantidadeTotalDeduzir = Number(comp.quantidade_necessaria) * qtdVendidaDoProduto;
    if (quantidadeTotalDeduzir <= 0) {
      continue;
    }

    const { error: errDeduzir } = await supabase.rpc('deduzir_estoque_insumo', {
      p_insumo_id: comp.insumo_id,
      p_quantidade: quantidadeTotalDeduzir,
    });

    if (errDeduzir) {
      throw new Error(`Falha ao deduzir estoque: ${errDeduzir.message}`);
    }
  }

  const hoje = new Date().toISOString().split('T')[0];
  const { error: errFunil } = await supabase.rpc('incrementar_compras_funil', {
    p_restaurante_id: restauranteId,
    p_data: hoje,
  });

  if (errFunil) {
    throw new Error(`Falha ao atualizar métricas de funil: ${errFunil.message}`);
  }
}

function mapearPedidoParaNotificacao(pedido: PedidoInternoBruto): PedidoParaNotificacao {
  const restaurante = Array.isArray(pedido.restaurantes) ? pedido.restaurantes[0] : pedido.restaurantes;

  return {
    id: pedido.id,
    status: pedido.status,
    codigoAcompanhamento: pedido.codigo_acompanhamento,
    dadosCliente: pedido.dados_cliente,
    restaurante: {
      id: pedido.restaurante_id,
      nome: restaurante?.nome ?? 'Restaurante',
      slug: restaurante?.slug ?? '',
    },
  };
}

export async function atualizarStatusPedidoComNotificacoes(params: {
  pedidoId: string;
  novoStatus: StatusPedido;
  mercadoPagoPaymentId?: string | null;
}) {
  const supabase = getSupabase();
  const pedidoAtual = await buscarPedidoInternoPorId(params.pedidoId);

  if (!pedidoAtual) {
    throw new Error('Pedido não encontrado para atualização de status.');
  }

  const statusAnterior = pedidoAtual.status;

  if (ehStatusPedidoTerminal(statusAnterior) && params.novoStatus !== statusAnterior) {
    return {
      mudouStatus: false,
      pedido: normalizarPedidoPublico(pedidoAtual),
    };
  }

  const mudouStatus = statusAnterior !== params.novoStatus;
  const precisaAtualizarPagamentoId = params.mercadoPagoPaymentId && pedidoAtual.mercado_pago_payment_id !== params.mercadoPagoPaymentId;

  if (!mudouStatus && !precisaAtualizarPagamentoId) {
    return {
      mudouStatus: false,
      pedido: normalizarPedidoPublico(pedidoAtual),
    };
  }

  const payloadAtualizacao: Record<string, unknown> = {
    status: params.novoStatus,
    updated_at: new Date().toISOString(),
  };

  if (params.mercadoPagoPaymentId) {
    payloadAtualizacao.mercado_pago_payment_id = params.mercadoPagoPaymentId;
  }

  if (params.novoStatus === 'SAIU_PARA_ENTREGA' && statusAnterior !== 'SAIU_PARA_ENTREGA') {
    try {
      const restauranteRelacionado = Array.isArray(pedidoAtual.restaurantes)
        ? pedidoAtual.restaurantes[0]
        : pedidoAtual.restaurantes;

      const origemValida =
        typeof restauranteRelacionado?.latitude === 'number' && typeof restauranteRelacionado?.longitude === 'number';
      const destinoValido =
        typeof pedidoAtual.cliente_latitude === 'number' && typeof pedidoAtual.cliente_longitude === 'number';

      if (origemValida && destinoValido) {
        const rota = await calcularRotaEntrega(
          { latitude: restauranteRelacionado.latitude as number, longitude: restauranteRelacionado.longitude as number },
          { latitude: pedidoAtual.cliente_latitude as number, longitude: pedidoAtual.cliente_longitude as number }
        );

        if (rota) {
          payloadAtualizacao.distancia_entrega_km = rota.distanciaKm;
          payloadAtualizacao.tempo_deslocamento_min = rota.duracaoMinutos;
        }
      }
    } catch (error) {
      console.error('Falha ao recalcular rota de entrega no despacho (mantendo estimativa anterior):', error);
    }
  }

  const { data: linhasAtualizadas, error: errUpdate } = await supabase
    .from('pedidos')
    .update(payloadAtualizacao)
    .eq('id', params.pedidoId)
    .eq('status', statusAnterior)
    .select('id');

  if (errUpdate) {
    throw errUpdate;
  }

  if (!linhasAtualizadas || linhasAtualizadas.length === 0) {
    return atualizarStatusPedidoComNotificacoes(params);
  }

  if (params.novoStatus === 'PAGO' && statusAnterior === 'PENDENTE') {
    await processarEfeitosColateraisPagamentoAprovado(params.pedidoId, pedidoAtual.restaurante_id);
  }

  const pedidoAtualizado = await buscarPedidoInternoPorId(params.pedidoId);
  if (!pedidoAtualizado) {
    throw new Error('Pedido atualizado não localizado.');
  }

  if (mudouStatus) {
    await enviarNotificacoesStatusPedido(mapearPedidoParaNotificacao(pedidoAtualizado));
  }

  return {
    mudouStatus,
    pedido: normalizarPedidoPublico(pedidoAtualizado),
  };
}

export function obterResumoPedidoPublico(pedido: PedidoPublico) {
  const tipoEntrega = obterTipoEntregaPedido(pedido.dados_cliente);
  return {
    ...pedido,
    tipo_entrega: tipoEntrega,
  };
}

export class ErroCancelamentoPedido extends Error {
  constructor(message: string, readonly httpStatus: number) {
    super(message);
    this.name = 'ErroCancelamentoPedido';
  }
}

export async function cancelarPedido(params: {
  pedidoId: string;
  restauranteId: string;
  motivo: string;
}): Promise<{ pedido: PedidoPublico; foiPago: boolean }> {
  const supabase = getSupabase();
  const motivo = params.motivo.replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!motivo) {
    throw new ErroCancelamentoPedido('Informe o motivo.', 400);
  }

  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const pedidoAtual = await buscarPedidoInternoPorId(params.pedidoId);
    if (!pedidoAtual || pedidoAtual.restaurante_id !== params.restauranteId) {
      throw new ErroCancelamentoPedido('Pedido não encontrado.', 404);
    }

    if (ehStatusPedidoTerminal(pedidoAtual.status)) {
      throw new ErroCancelamentoPedido(
        pedidoAtual.status === 'CANCELADO' ? 'Este pedido já foi cancelado.' : 'Este pedido já foi finalizado e não pode ser cancelado.',
        409
      );
    }

    const agora = new Date().toISOString();
    const { data: linhas, error: errUpdate } = await supabase
      .from('pedidos')
      .update({
        status: 'CANCELADO',
        motivo_cancelamento: motivo,
        cancelado_em: agora,
        updated_at: agora,
      })
      .eq('id', params.pedidoId)
      .eq('status', pedidoAtual.status)
      .select('id');

    if (errUpdate) {
      throw errUpdate;
    }

    if (!linhas || linhas.length === 0) {
      continue;
    }

    const pedidoAtualizado = await buscarPedidoInternoPorId(params.pedidoId);
    if (!pedidoAtualizado) {
      throw new ErroCancelamentoPedido('Pedido cancelado não localizado.', 500);
    }

    try {
      await enviarNotificacoesStatusPedido(mapearPedidoParaNotificacao(pedidoAtualizado));
    } catch (error) {
      console.error('[pedido:cancelamento] Falha ao notificar cliente.', error);
    }

    return { pedido: normalizarPedidoPublico(pedidoAtualizado), foiPago: pedidoAtual.status !== 'PENDENTE' };
  }

  throw new ErroCancelamentoPedido('O pedido mudou de etapa enquanto era cancelado. Tente novamente.', 409);
}
