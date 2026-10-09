'use server';

import { obterRestauranteIdDoGestorLogado } from '@/utils/admin-auth';
import { createClient } from '@/utils/supabase/server';
import {
  calcularIntervalo,
  hojeEmBrasilia,
  limitesUtcDoIntervalo,
  type PeriodoMetricas,
} from '@/utils/periodo-metricas';

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
  /** Pedidos pagos no período (base do CPA e do ticket médio). */
  pedidosPagos: number;
  taxaConversaoCardapio: number;
  taxaAbandonoCarrinho: number;
  faturamentoTotal: number;
  custoInsumosTotal: number;
  lucroOperacionalBruto: number;
}

async function obterRestauranteIdLogado(): Promise<string> {
  return obterRestauranteIdDoGestorLogado();
}

export async function obterMetricasGrowth(periodo: PeriodoMetricas = 'hoje'): Promise<ResumoMetricasFunil> {
  try {
    const supabase = await createClient();
    const restauranteId = await obterRestauranteIdLogado();
    const intervalo = calcularIntervalo(periodo, hojeEmBrasilia());
    const limites = limitesUtcDoIntervalo(intervalo);

    const { data: linhasFunil } = await supabase
      .from('metricas_funil')
      .select('visitas_cardapio, checkouts_iniciados, compras_concluidas')
      .eq('restaurante_id', restauranteId)
      .gte('data', intervalo.desde)
      .lte('data', intervalo.ate);

    let visitas = 0;
    let checkouts = 0;
    let compras = 0;
    (linhasFunil || []).forEach((linha) => {
      visitas += Number(linha.visitas_cardapio) || 0;
      checkouts += Number(linha.checkouts_iniciados) || 0;
      compras += Number(linha.compras_concluidas) || 0;
    });

    const taxaConversaoCardapio = visitas > 0 ? (compras / visitas) * 100 : 0;
    const taxaAbandonoCarrinho = checkouts > 0 ? ((checkouts - compras) / checkouts) * 100 : 0;

    const { data: pedidosPeriodo, error: errPedidos } = await supabase
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
      .in('status', ['PAGO', 'PREPARANDO', 'PRONTO', 'SAIU_PARA_ENTREGA', 'ENTREGUE'])
      .gte('created_at', limites.inicio)
      .lte('created_at', limites.fim);

    if (errPedidos) {
      console.error('Erro ao buscar pedidos do período:', errPedidos);
    }

    const faturamentoTotal = pedidosPeriodo?.reduce((acc, p) => acc + Number(p.valor_total), 0) || 0;
    let custoInsumosTotal = 0;

    if (pedidosPeriodo && pedidosPeriodo.length > 0) {
      (pedidosPeriodo as PedidoMetricaBruta[] as PedidoMetrica[]).forEach((pedido) => {
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
      pedidosPagos: pedidosPeriodo?.length ?? 0,
      taxaConversaoCardapio: Math.round(taxaConversaoCardapio * 10) / 10,
      taxaAbandonoCarrinho: Math.round(Math.max(0, taxaAbandonoCarrinho) * 10) / 10,
      faturamentoTotal: Math.round(faturamentoTotal * 100) / 100,
      custoInsumosTotal: Math.round(custoInsumosTotal * 100) / 100,
      lucroOperacionalBruto: Math.round(lucroOperacionalBruto * 100) / 100,
    };
  } catch (error) {
    console.error('Erro na action obterMetricasGrowth:', error);
    return {
      visitas: 0,
      checkouts: 0,
      compras: 0,
      pedidosPagos: 0,
      taxaConversaoCardapio: 0,
      taxaAbandonoCarrinho: 0,
      faturamentoTotal: 0,
      custoInsumosTotal: 0,
      lucroOperacionalBruto: 0,
    };
  }
}
