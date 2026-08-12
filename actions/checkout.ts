'use server';

import { createClient } from '@/utils/supabase/server';
import { FormaPagamento } from '@/types/database';

interface ItemPedidoInput {
  item_cardapio_id: string;
  quantidade: number;
  preco_unitario: number;
}

interface DadosClienteInput {
  nome: string;
  telefone: string;
  endereco: {
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    cep: string;
  };
}

interface ItemCardapioPreco {
  id: string;
  preco_venda: number;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Falha catastrófica no checkout.';
}

function formaPagamentoValida(formaPagamento: FormaPagamento): boolean {
  return formaPagamento === 'PIX' || formaPagamento === 'DINHEIRO' || formaPagamento === 'CARTAO';
}

export async function processarPedidoCheckout(
  slug: string,
  formaPagamento: FormaPagamento,
  dadosCliente: DadosClienteInput,
  itens: ItemPedidoInput[]
) {
  try {
    const supabase = await createClient();
    const slugNormalizado = slug.trim();

    if (!slugNormalizado || itens.length === 0) {
      return { success: false, error: 'Dados do checkout incompletos.' };
    }
    if (!formaPagamentoValida(formaPagamento)) {
      return { success: false, error: 'Forma de pagamento inválida.' };
    }

    if (!dadosCliente.nome?.trim() || !dadosCliente.telefone?.trim()) {
      return { success: false, error: 'Dados do cliente inválidos.' };
    }

    const itensValidos = itens.every((item) =>
      typeof item.item_cardapio_id === 'string' &&
      item.item_cardapio_id.length > 0 &&
      Number.isInteger(item.quantidade) &&
      item.quantidade > 0
    );

    if (!itensValidos) {
      return { success: false, error: 'Itens do pedido inválidos.' };
    }

    const { data: restaurante, error: errRestaurante } = await supabase
      .from('restaurantes')
      .select('id')
      .eq('slug', slugNormalizado)
      .maybeSingle();

    if (errRestaurante || !restaurante) {
      return { success: false, error: 'Restaurante inválido ou indisponível.' };
    }

    const itemIds = itens.map((item) => item.item_cardapio_id);
    const { data: itensCardapio, error: errItensCardapio } = await supabase
      .from('itens_cardapio')
      .select('id, preco_venda')
      .eq('restaurante_id', restaurante.id)
      .in('id', itemIds);

    if (errItensCardapio || !itensCardapio || itensCardapio.length !== itemIds.length) {
      return { success: false, error: 'Itens inválidos para este restaurante.' };
    }

    const precoPorItem = new Map(
      (itensCardapio as ItemCardapioPreco[]).map((item) => [item.id, Number(item.preco_venda)])
    );

    const valorTotalCalculado = itens.reduce((acc, item) => {
      const preco = precoPorItem.get(item.item_cardapio_id);
      if (!preco) {
        return acc;
      }
      return acc + preco * item.quantidade;
    }, 0);

    const { data: novoPedido, error: errPedido } = await supabase
      .from('pedidos')
      .insert([{
        restaurante_id: restaurante.id,
        status: 'PENDENTE',
        valor_total: Math.round(valorTotalCalculado * 100) / 100,
        forma_pagamento: formaPagamento,
        dados_cliente: dadosCliente
      }])
      .select()
      .single();

    if (errPedido || !novoPedido) {
      console.error('Erro ao criar pedido mestre:', errPedido);
      return { success: false, error: 'Falha ao processar as informações do pedido.' };
    }

    const linhasItens = itens.map(item => ({
      pedido_id: novoPedido.id,
      item_cardapio_id: item.item_cardapio_id,
      quantidade: item.quantidade,
      preco_unitario: precoPorItem.get(item.item_cardapio_id) ?? 0
    }));

    const { error: errItens } = await supabase
      .from('itens_pedido')
      .insert(linhasItens);

    if (errItens) {
      console.error('Erro ao registrar linhas do pedido:', errItens);
      return { success: false, error: 'Erro ao registrar itens do pedido.' };
    }

    const { data: composicoes, error: errCompo } = await supabase
      .from('composicao_produto')
      .select('item_cardapio_id, insumo_id, quantidade_necessaria')
      .in('item_cardapio_id', itemIds);

    if (errCompo) {
      throw new Error(`Falha ao carregar composição dos produtos: ${errCompo.message}`);
    }

    if (composicoes) {
      const quantidadePorItem = new Map(itens.map(i => [i.item_cardapio_id, i.quantidade]));

      for (const comp of composicoes) {
        const qtdVendidaDoProduto = quantidadePorItem.get(comp.item_cardapio_id) || 0;
        const quantidadeTotalDeduzir = Number(comp.quantidade_necessaria) * qtdVendidaDoProduto;
        
        if (quantidadeTotalDeduzir > 0) {
          const { error: errDeduzir } = await supabase.rpc('deduzir_estoque_insumo', {
            p_insumo_id: comp.insumo_id,
            p_quantidade: quantidadeTotalDeduzir
          });
          if (errDeduzir) {
            throw new Error(`Falha ao deduzir estoque: ${errDeduzir.message}`);
          }
        }
      }
    }

    const hoje = new Date().toISOString().split('T')[0];
    
    const { error: errFunil } = await supabase.rpc('incrementar_compras_funil', {
      p_restaurante_id: restaurante.id,
      p_data: hoje
    });
    if (errFunil) {
      throw new Error(`Falha ao atualizar métricas de funil: ${errFunil.message}`);
    }

    return { success: true, pedidoId: novoPedido.id };
  } catch (error: unknown) {
    console.error('Erro crítico durante fluxo de processarPedidoCheckout:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
