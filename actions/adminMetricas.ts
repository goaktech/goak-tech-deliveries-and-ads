'use server';

import { createClient } from '@/utils/supabase/server';

interface ComposicaoInsumoPedido {
  quantidade_necessaria: number | string | null;
  insumos: {
    custo_unitario: number | string | null;
  } | null;
}

interface ItemPedidoMetrica {
  quantidade: number | string | null;
  itens_cardapio: {
    composicao_produto: ComposicaoInsumoPedido[] | null;
  } | null;
}

interface PedidoMetrica {
  valor_total: number | string | null;
  itens_pedido: ItemPedidoMetrica[] | null;
}

type PedidoMetricaBruta = unknown;

export interface ResumoMetricasFunil {
  visitas: number;
  checkouts: number;
  compras: number;
  taxaConversaoCardapio: number;
  taxaAbandonoCarrinho: number;
  faturamentoTotal: number;
  custoInsumosTotal: number;
  lucroOperacionalBruto: number;
}

async function obterRestauranteIdLogado(): Promise<string> {
  const supabase = await createClient();
  
  const { data: { user }, error: errUser } = await supabase.auth.getUser();
  if (errUser || !user) {
    throw new Error('Usuário não autenticado no Centro de Comando.');
  }

  const { data: perfil, error: errPerfil } = await supabase
    .from('perfis_admin')
    .select('restaurante_id')
    .eq('id', user.id)
    .single();

  if (errPerfil || !perfil) {
    throw new Error('Perfil administrativo ou restaurante não localizado.');
  }

  return perfil.restaurante_id;
}

export async function obterMetricasGrowthDoDia(): Promise<ResumoMetricasFunil> {
  try {
    const supabase = await createClient();
    const restauranteId = await obterRestauranteIdLogado();
    const hoje = new Date().toISOString().split('T')[0];

    const { data: metricasFunil } = await supabase
      .from('metricas_funil')
      .select('visitas_cardapio, checkouts_iniciados, compras_concluidas')
      .eq('restaurante_id', restauranteId)
      .eq('data', hoje)
      .maybeSingle();

    const visitas = metricasFunil?.visitas_cardapio ? Number(metricasFunil.visitas_cardapio) : 0;
    const checkouts = metricasFunil?.checkouts_iniciados ? Number(metricasFunil.checkouts_iniciados) : 0;
    const compras = metricasFunil?.compras_concluidas ? Number(metricasFunil.compras_concluidas) : 0;

    const taxaConversaoCardapio = visitas > 0 ? (compras / visitas) * 100 : 0;
    const taxaAbandonoCarrinho = checkouts > 0 ? ((checkouts - compras) / checkouts) * 100 : 0;

    const { data: pedidosHoje, error: errPedidos } = await supabase
      .from('pedidos')
      .select(`
        id, 
        valor_total,
        itens_pedido (
          quantidade,
          item_cardapio_id,
          itens_cardapio (
            composicao_produto (
              quantidade_necessaria,
              insumos ( custo_unitario )
            )
          )
        )
      `)
      .eq('restaurante_id', restauranteId)
      .eq('status', 'PAGO')
      .gte('created_at', `${hoje}T00:00:00.000Z`)
      .lte('created_at', `${hoje}T23:59:59.999Z`);

    if (errPedidos) {
      console.error('Erro ao buscar pedidos do dia:', errPedidos);
    }

    const faturamentoTotal = pedidosHoje?.reduce((acc, p) => acc + Number(p.valor_total), 0) || 0;
    let custoInsumosTotal = 0;

    if (pedidosHoje && pedidosHoje.length > 0) {
      (pedidosHoje as PedidoMetricaBruta[] as PedidoMetrica[]).forEach((pedido) => {
        const itens = pedido.itens_pedido || [];
        itens.forEach((item) => {
          const quantidadeVendida = Number(item.quantidade);
          const composicoes = item.itens_cardapio?.composicao_produto || [];
          
          composicoes.forEach((comp) => {
            const quantidadeNecessaria = Number(comp.quantidade_necessaria);
            const custoUnitarioInsumo = Number(comp.insumos?.custo_unitario || 0);
            
            custoInsumosTotal += quantidadeVendida * quantidadeNecessaria * custoUnitarioInsumo;
          });
        });
      });
    }

    const lucroOperacionalBruto = faturamentoTotal - custoInsumosTotal;

    return {
      visitas,
      checkouts,
      compras,
      taxaConversaoCardapio: Math.round(taxaConversaoCardapio * 10) / 10,
      taxaAbandonoCarrinho: Math.round(Math.max(0, taxaAbandonoCarrinho) * 10) / 10,
      faturamentoTotal: Math.round(faturamentoTotal * 100) / 100,
      custoInsumosTotal: Math.round(custoInsumosTotal * 100) / 100,
      lucroOperacionalBruto: Math.round(lucroOperacionalBruto * 100) / 100,
    };
  } catch (error) {
    console.error('Erro na action obterMetricasGrowthDoDia:', error);
    return {
      visitas: 0,
      checkouts: 0,
      compras: 0,
      taxaConversaoCardapio: 0,
      taxaAbandonoCarrinho: 0,
      faturamentoTotal: 0,
      custoInsumosTotal: 0,
      lucroOperacionalBruto: 0,
    };
  }
}
