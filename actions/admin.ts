'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface AdicionalCustomizadoInput {
  nome: string;
  preco: number;
}

export interface InsumoFichaInput {
  insumo_id: string;
  quantidade_necessaria: number;
}

interface ProdutoComposicao {
  insumo_id: string;
  quantidade_necessaria: number | null;
  insumos:
    | Array<{
      nome: string;
      custo_unitario: number | null;
      unidade_medida: string;
    }>
    | {
    nome: string;
    custo_unitario: number | null;
    unidade_medida: string;
  }
    | null;
}

interface ComplementoProdutoBruto {
  id: string;
  nome: string;
  preco_adicional: number | string | null;
  disponivel: boolean | null;
}

interface ItemCardapioBruto {
  id: string;
  nome: string;
  descricao: string | null;
  preco_venda: number | null;
  disponivel: boolean | null;
  imagem_url: string | null;
  categoria: string | null;
  dia_semana: number | null;
  composicao_produto: ProdutoComposicao[] | null;
  complementos_produto: ComplementoProdutoBruto[] | null;
}

export interface ItemCardapioComCMV {
  id: string;
  nome: string;
  descricao: string;
  preco_venda: number;
  disponivel: boolean;
  imagem_url: string | null;
  /** Categoria estrutural do item (ex.: "Pratos", "Acompanhamentos", "Bebidas", "Sobremesas"). Opcional. */
  categoria: string | null;
  /** Dia da semana em que o item fica disponível (0=Domingo .. 6=Sábado). null = disponível todos os dias. */
  dia_semana: number | null;
  custo_producao: number;
  percentual_cmv: number;
  margem_lucro: number;
  ingredientes: Array<{ nome: string; quantidade: number; unidade: string }>;
  fichaTecnica: Array<{ insumo_id: string; quantidade_necessaria: number }>;
  complementos: Array<{ id: string; nome: string; preco_adicional: number; disponivel: boolean }>;
}

export type AdicionalCustomizado = AdicionalCustomizadoInput;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Erro desconhecido.';
}

export async function criarProdutoComComplementos(
  nome: string,
  descricao: string,
  precoVenda: number,
  fichaTecnica: InsumoFichaInput[],
  complementos: AdicionalCustomizado[]
) {
  const supabase = await createClient()

  try {
    const { data: { user }, error: erroAuth } = await supabase.auth.getUser()
    if (erroAuth || !user) {
      throw new Error('Usuário não autenticado ou sessão expirada.')
    }

    const { data: perfilAdmin, error: erroPerfil } = await supabase
      .from('perfis_admin')
      .select('restaurante_id')
      .eq('id', user.id)
      .single()

    if (erroPerfil || !perfilAdmin?.restaurante_id) {
      console.error('Erro ao recuperar tenant do administrador:', erroPerfil)
      throw new Error('Nenhum restaurante associado a este perfil de administrador.')
    }

    const restauranteId = perfilAdmin.restaurante_id

    const { data: novoItem, error: erroItem } = await supabase
      .from('itens_cardapio')
      .insert({
        restaurante_id: restauranteId,
        nome,
        descricao,
        preco_venda: precoVenda,
        disponivel: true
      })
      .select('id')
      .single()

    if (erroItem || !novoItem) {
      console.error('Erro detalhado da tabela itens_cardapio:', erroItem)
      throw new Error(`Falha crítica ao criar item de cardápio: ${erroItem?.message}`)
    }

    const itemId = novoItem.id

    if (complementos && complementos.length > 0) {
      const dadosComplementos = complementos.map(comp => ({
        item_cardapio_id: itemId,
        nome: comp.nome,
        preco_adicional: comp.preco,
        disponivel: true
      }))

      const { error: erroComplementos } = await supabase
        .from('complementos_produto')
        .insert(dadosComplementos)

      if (erroComplementos) {
        console.error('Erro ao inserir complementos do produto:', erroComplementos)
        throw new Error(`Produto criado, mas falhou ao salvar adicionais: ${erroComplementos.message}`)
      }
    }

    if (fichaTecnica && fichaTecnica.length > 0) {
      const dadosComposicao = fichaTecnica.map(ficha => ({
        item_cardapio_id: itemId,
        insumo_id: ficha.insumo_id,
        quantidade_necessaria: ficha.quantidade_necessaria
      }))

      const { error: erroComposicao } = await supabase
        .from('composicao_produto')
        .insert(dadosComposicao)

      if (erroComposicao) {
        console.error('Erro ao salvar ficha técnica:', erroComposicao)
        throw new Error(`Produto e adicionais criados, mas falhou na ficha técnica: ${erroComposicao.message}`)
      }
    }

    revalidatePath('/admin/produtos')
    
    return { success: true, itemId }

  } catch (error: unknown) {
    const message = getErrorMessage(error)
    console.error('Erro ao criar produto com complementos:', message)
    return { success: false, error: message }
  }
}


export async function alternarDisponibilidadeProduto(id: string, statusAtual: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('itens_cardapio')
    .update({ disponivel: !statusAtual })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/produtos')
}

export async function atualizarStatusEmLote(ids: string[], novoStatus: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('itens_cardapio')
    .update({ disponivel: novoStatus })
    .in('id', ids)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/produtos')
}

export async function excluirProdutosEmLote(ids: string[]) {
  if (ids.length === 0) {
    return { success: true }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('itens_cardapio')
    .update({ arquivado: true, disponivel: false })
    .in('id', ids)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/produtos')
  return { success: true }
}

export async function listarProdutosComCMV(): Promise<ItemCardapioComCMV[]> {
  const supabase = await createClient()

  const { data: perfil } = await supabase
    .from('perfis_admin')
    .select('restaurante_id')
    .single()

  if (!perfil?.restaurante_id) return []

  const { data: itens, error } = await supabase
    .from('itens_cardapio')
    .select(`
      id,
      nome,
      descricao,
      preco_venda,
      disponivel,
      imagem_url,
      categoria,
      dia_semana,
      composicao_produto (
        insumo_id,
        quantidade_necessaria,
        insumos (
          nome,
          custo_unitario,
          unidade_medida
        )
      ),
      complementos_produto (
        id,
        nome,
        preco_adicional,
        disponivel
      )
    `)
    .eq('restaurante_id', perfil.restaurante_id)
    .eq('arquivado', false)
    .order('ordem', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error || !itens) return []

  return (itens as unknown as ItemCardapioBruto[]).map((item) => {
    let custoProducao = 0;
    const ingredientes: ItemCardapioComCMV['ingredientes'] = [];
    const fichaTecnica: ItemCardapioComCMV['fichaTecnica'] = [];

    if (item.composicao_produto) {
      item.composicao_produto.forEach((comp) => {
        const insumo = Array.isArray(comp.insumos) ? comp.insumos[0] : comp.insumos;
        const necessaria = Number(comp.quantidade_necessaria || 0);

        if (comp.insumo_id) {
          fichaTecnica.push({ insumo_id: comp.insumo_id, quantidade_necessaria: necessaria });
        }

        if (insumo) {
          const unitario = Number(insumo.custo_unitario || 0);
          custoProducao += unitario * necessaria;

          ingredientes.push({
            nome: insumo.nome,
            quantidade: necessaria,
            unidade: insumo.unidade_medida
          });
        }
      });
    }

    const precoVenda = Number(item.preco_venda || 0);
    const percentualCmv = precoVenda > 0 ? (custoProducao / precoVenda) * 100 : 0;
    const margemLucro = precoVenda - custoProducao;

    const complementos = (item.complementos_produto || []).map((comp) => ({
      id: comp.id,
      nome: comp.nome,
      preco_adicional: Number(comp.preco_adicional || 0),
      disponivel: comp.disponivel !== false
    }));

    return {
      id: item.id,
      nome: item.nome,
      descricao: item.descricao || '',
      preco_venda: precoVenda,
      disponivel: !!item.disponivel,
      imagem_url: item.imagem_url ?? null,
      categoria: item.categoria ?? null,
      dia_semana: item.dia_semana ?? null,
      custo_producao: custoProducao,
      percentual_cmv: percentualCmv,
      margem_lucro: margemLucro,
      ingredientes,
      fichaTecnica,
      complementos
    };
  });
}

export async function criarProdutoComFichaTecnica(
  nome: string,
  descricao: string,
  precoVenda: number,
  fichaTecnica: InsumoFichaInput[]
) {
  return criarProdutoComComplementos(nome, descricao, precoVenda, fichaTecnica, [])
}
