
import { randomUUID } from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { atualizarStatusPedidoComNotificacoes } from '@/utils/pedidos-acompanhamento';
import { type DadosClientePedido, type StatusPedido, obterTipoEntregaPedido } from '@/utils/pedido-status';

export interface Entregador {
  id: string;
  restauranteId: string;
  nome: string;
  telefone: string;
  ativo: boolean;
  tokenAcesso: string;
}

interface EntregadorBruto {
  id: string;
  restaurante_id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
  token_acesso: string;
}

export interface PedidoParaEntregador {
  id: string;
  codigoAcompanhamento: string;
  status: StatusPedido;
  dadosCliente: DadosClientePedido;
  valorTotal: number;
  distanciaEntregaKm: number | null;
  tempoDeslocamentoMin: number | null;
  createdAt: string;
  clienteLatitude: number | null;
  clienteLongitude: number | null;
}

interface PedidoParaEntregadorBruto {
  id: string;
  codigo_acompanhamento: string;
  status: StatusPedido;
  dados_cliente: DadosClientePedido;
  valor_total: number;
  distancia_entrega_km: number | null;
  tempo_deslocamento_min: number | null;
  created_at: string;
  cliente_latitude: number | null;
  cliente_longitude: number | null;
}

function getSupabase() {
  return createWebhookAdminClient();
}

export function gerarTokenAcessoEntregador() {
  return randomUUID().replace(/-/g, '');
}

function mapearEntregador(bruto: EntregadorBruto): Entregador {
  return {
    id: bruto.id,
    restauranteId: bruto.restaurante_id,
    nome: bruto.nome,
    telefone: bruto.telefone,
    ativo: bruto.ativo,
    tokenAcesso: bruto.token_acesso,
  };
}

function mapearPedidoParaEntregador(bruto: PedidoParaEntregadorBruto): PedidoParaEntregador {
  return {
    id: bruto.id,
    codigoAcompanhamento: bruto.codigo_acompanhamento,
    status: bruto.status,
    dadosCliente: bruto.dados_cliente,
    valorTotal: Number(bruto.valor_total),
    distanciaEntregaKm: bruto.distancia_entrega_km != null ? Number(bruto.distancia_entrega_km) : null,
    tempoDeslocamentoMin: bruto.tempo_deslocamento_min != null ? Number(bruto.tempo_deslocamento_min) : null,
    createdAt: bruto.created_at,
    clienteLatitude: typeof bruto.cliente_latitude === 'number' ? bruto.cliente_latitude : null,
    clienteLongitude: typeof bruto.cliente_longitude === 'number' ? bruto.cliente_longitude : null,
  };
}

const SELECT_ENTREGADOR = 'id, restaurante_id, nome, telefone, ativo, token_acesso';
const SELECT_PEDIDO_ENTREGADOR =
  'id, codigo_acompanhamento, status, dados_cliente, valor_total, distancia_entrega_km, tempo_deslocamento_min, created_at, cliente_latitude, cliente_longitude';

export async function criarEntregador(restauranteId: string, nome: string, telefone: string): Promise<Entregador> {
  const supabase = getSupabase();
  const tokenAcesso = gerarTokenAcessoEntregador();

  const { data, error } = await supabase
    .from('entregadores')
    .insert([
      {
        restaurante_id: restauranteId,
        nome: nome.trim(),
        telefone: telefone.trim(),
        token_acesso: tokenAcesso,
      },
    ])
    .select(SELECT_ENTREGADOR)
    .single();

  if (error || !data) {
    throw error || new Error('Falha ao criar entregador.');
  }

  return mapearEntregador(data as EntregadorBruto);
}

export async function listarEntregadores(restauranteId: string): Promise<Entregador[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('entregadores')
    .select(SELECT_ENTREGADOR)
    .eq('restaurante_id', restauranteId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as EntregadorBruto[]).map(mapearEntregador);
}

export async function atualizarStatusAtivoEntregador(
  restauranteId: string,
  entregadorId: string,
  ativo: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('entregadores')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('id', entregadorId)
    .eq('restaurante_id', restauranteId);

  if (error) {
    return { success: false, error: 'Falha ao atualizar entregador.' };
  }

  return { success: true };
}

export async function buscarEntregadorPorToken(token: string): Promise<Entregador | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('entregadores')
    .select(SELECT_ENTREGADOR)
    .eq('token_acesso', token)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapearEntregador(data as EntregadorBruto);
}

export async function listarPedidosDisponiveisParaCaptura(restauranteId: string): Promise<PedidoParaEntregador[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_ENTREGADOR)
    .eq('restaurante_id', restauranteId)
    .eq('status', 'PRONTO')
    .is('entregador_id', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as PedidoParaEntregadorBruto[])
    .filter((pedido) => obterTipoEntregaPedido(pedido.dados_cliente) === 'ENTREGA')
    .map(mapearPedidoParaEntregador);
}

export async function listarPedidosAtivosDoEntregador(entregadorId: string): Promise<PedidoParaEntregador[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_ENTREGADOR)
    .eq('entregador_id', entregadorId)
    .eq('status', 'SAIU_PARA_ENTREGA')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as PedidoParaEntregadorBruto[]).map(mapearPedidoParaEntregador);
}

export async function capturarPedido(
  pedidoId: string,
  entregadorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('pedidos')
    .update({ entregador_id: entregadorId })
    .eq('id', pedidoId)
    .eq('status', 'PRONTO')
    .is('entregador_id', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return { success: false, error: 'Falha ao capturar pedido.' };
  }

  if (!data) {
    return { success: false, error: 'Esse pedido já foi capturado por outro entregador (ou não está mais disponível).' };
  }

  try {
    await atualizarStatusPedidoComNotificacoes({ pedidoId, novoStatus: 'SAIU_PARA_ENTREGA' });
  } catch (erro) {
    console.error('Falha ao avançar status do pedido após captura pelo entregador:', erro);
  }

  return { success: true };
}

export async function atribuirEntregadorManualmente(params: {
  pedidoId: string;
  entregadorId: string | null;
  restauranteId: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  const { data: pedido, error: errPedido } = await supabase
    .from('pedidos')
    .select('id, restaurante_id')
    .eq('id', params.pedidoId)
    .maybeSingle();

  if (errPedido || !pedido || pedido.restaurante_id !== params.restauranteId) {
    return { success: false, error: 'Pedido não encontrado.' };
  }

  if (params.entregadorId) {
    const { data: entregador, error: errEntregador } = await supabase
      .from('entregadores')
      .select('id, restaurante_id')
      .eq('id', params.entregadorId)
      .maybeSingle();

    if (errEntregador || !entregador || entregador.restaurante_id !== params.restauranteId) {
      return { success: false, error: 'Entregador não encontrado.' };
    }
  }

  const { error } = await supabase
    .from('pedidos')
    .update({ entregador_id: params.entregadorId })
    .eq('id', params.pedidoId);

  if (error) {
    return { success: false, error: 'Falha ao atribuir entregador.' };
  }

  return { success: true };
}

export async function marcarEntregaConcluidaPeloEntregador(
  pedidoId: string,
  entregadorId: string,
  codigoInformado: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('id, entregador_id, status, codigo_confirmacao_entrega')
    .eq('id', pedidoId)
    .maybeSingle();

  if (error || !pedido || pedido.entregador_id !== entregadorId) {
    return { success: false, error: 'Pedido não encontrado ou não pertence a este entregador.' };
  }

  if (pedido.status !== 'SAIU_PARA_ENTREGA') {
    return { success: false, error: 'Este pedido não está em rota de entrega.' };
  }

  if (pedido.codigo_confirmacao_entrega !== codigoInformado.trim()) {
    return { success: false, error: 'Código de confirmação incorreto.' };
  }

  await atualizarStatusPedidoComNotificacoes({ pedidoId, novoStatus: 'ENTREGUE' });
  return { success: true };
}
