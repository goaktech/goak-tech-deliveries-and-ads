'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

interface DadosNovoProduto {
  nome: string
  descricao?: string
  preco_venda: number
  disponivel: boolean
  fichaTecnica: Record<string, string>
  adicionais: Array<{ nome: string; preco: number }>
  imagemDataUrl?: string
}

const BUCKET_IMAGENS_PRODUTOS =
  process.env.SUPABASE_PRODUTOS_BUCKET ??
  process.env.SUPABASE_CARDAPIO_BUCKET ??
  'produtos'
const TAMANHO_MAXIMO_IMAGEM_BYTES = 5 * 1024 * 1024

function parseImagemDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/)
  if (!match) {
    throw new Error('Formato da imagem inválido. Use PNG, JPG ou WEBP.')
  }

  const mimeType = match[1]
  const base64Data = match[2]
  const buffer = Buffer.from(base64Data, 'base64')

  if (buffer.length === 0) {
    throw new Error('Arquivo de imagem vazio.')
  }
  if (buffer.length > TAMANHO_MAXIMO_IMAGEM_BYTES) {
    throw new Error('A imagem excede o limite de 5MB.')
  }

  const extensaoPorMimeType: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp'
  }

  const extensao = extensaoPorMimeType[mimeType]
  if (!extensao) {
    throw new Error('Tipo de imagem não suportado.')
  }

  return { buffer, mimeType, extensao }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Erro desconhecido no servidor.'
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function obterContextoGestorLogado(supabase: SupabaseServerClient) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Usuário não autenticado no sistema.')
  }

  const { data: perfil, error: perfilError } = await supabase
    .from('perfis_admin')
    .select('restaurante_id')
    .eq('id', user.id)
    .single()

  if (perfilError || !perfil?.restaurante_id) {
    throw new Error('Nenhum restaurante associado a esta conta de gestor.')
  }

  const restauranteId = perfil.restaurante_id as string

  const { data: restaurante, error: restError } = await supabase
    .from('restaurantes')
    .select('slug')
    .eq('id', restauranteId)
    .single()

  if (restError || !restaurante?.slug) {
    throw new Error('Falha crítica ao obter identificador (slug) da loja.')
  }

  return { restauranteId, slug: restaurante.slug as string }
}

export async function criarProdutoAdmin(dados: DadosNovoProduto) {
  const supabase = await createClient()

  let caminhoImagemUpload: string | null = null
  let produtoCriado = false

  try {
    const { restauranteId, slug } = await obterContextoGestorLogado(supabase)

    const { data: ultimoItem } = await supabase
      .from('itens_cardapio')
      .select('ordem')
      .eq('restaurante_id', restauranteId)
      .order('ordem', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    const proximaOrdem = (ultimoItem?.ordem ?? -1) + 1

    let imagemUrl: string | null = null

    if (dados.imagemDataUrl) {
      const imagem = parseImagemDataUrl(dados.imagemDataUrl)
      caminhoImagemUpload = `${restauranteId}/${crypto.randomUUID()}.${imagem.extensao}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_IMAGENS_PRODUTOS)
        .upload(caminhoImagemUpload, imagem.buffer, {
          contentType: imagem.mimeType,
          upsert: false
        })

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error(
            `Bucket "${BUCKET_IMAGENS_PRODUTOS}" não encontrado no Supabase Storage. Crie o bucket ou ajuste SUPABASE_PRODUTOS_BUCKET/.env.local.`
          )
        }
        throw new Error(`Falha ao enviar imagem do produto: ${uploadError.message}`)
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_IMAGENS_PRODUTOS)
        .getPublicUrl(caminhoImagemUpload)

      if (!publicUrlData?.publicUrl) {
        throw new Error('Falha ao gerar URL pública da imagem do produto.')
      }

      imagemUrl = publicUrlData.publicUrl
    }

    const { data: produto, error: prodError } = await supabase
      .from('itens_cardapio')
      .insert({
        restaurante_id: restauranteId,
        nome: dados.nome,
        descricao: dados.descricao || null,
        preco_venda: dados.preco_venda,
        imagem_url: imagemUrl,
        disponivel: dados.disponivel,
        ordem: proximaOrdem
      })
      .select()
      .single()

    if (prodError) throw prodError
    produtoCriado = true

    const insumosFiltrados = Object.entries(dados.fichaTecnica).filter(([, qtd]) => parseFloat(qtd) > 0)
    
    if (insumosFiltrados.length > 0) {
      const composicaoInserts = insumosFiltrados.map(([insumoId, qtd]) => ({
        item_cardapio_id: produto.id,
        insumo_id: insumoId,
        quantidade_necessaria: parseFloat(qtd)
      }))

      const { error: compError } = await supabase
        .from('composicao_produto')
        .insert(composicaoInserts)

      if (compError) throw compError
    }

    if (dados.adicionais.length > 0) {
      const complementosInserts = dados.adicionais.map(adicional => ({
        item_cardapio_id: produto.id,
        nome: adicional.nome,
        preco_adicional: adicional.preco,
        disponivel: true
      }))

      const { error: complError } = await supabase
        .from('complementos_produto')
        .insert(complementosInserts)

      if (complError) throw complError
    }

    revalidatePath(`/${slug}`)
    revalidatePath('/admin/produtos')

    return { success: true }
  } catch (error: unknown) {
    if (!produtoCriado && caminhoImagemUpload) {
      await supabase.storage
        .from(BUCKET_IMAGENS_PRODUTOS)
        .remove([caminhoImagemUpload])
    }

    const message = getErrorMessage(error)
    console.error('[SERVER ACTION ERROR] Falha ao registrar produto:', error)
    return { success: false, error: message }
  }
}

export async function atualizarProdutoAdmin(itemId: string, dados: DadosNovoProduto) {
  const supabase = await createClient()

  let caminhoImagemUpload: string | null = null

  try {
    const { restauranteId, slug } = await obterContextoGestorLogado(supabase)

    const { data: itemAtual, error: itemError } = await supabase
      .from('itens_cardapio')
      .select('id, imagem_url')
      .eq('id', itemId)
      .eq('restaurante_id', restauranteId)
      .maybeSingle()

    if (itemError || !itemAtual) {
      throw new Error('Item de cardápio não encontrado para este restaurante.')
    }

    let imagemUrl: string | null = itemAtual.imagem_url ?? null

    if (dados.imagemDataUrl) {
      const imagem = parseImagemDataUrl(dados.imagemDataUrl)
      caminhoImagemUpload = `${restauranteId}/${crypto.randomUUID()}.${imagem.extensao}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_IMAGENS_PRODUTOS)
        .upload(caminhoImagemUpload, imagem.buffer, {
          contentType: imagem.mimeType,
          upsert: false
        })

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error(
            `Bucket "${BUCKET_IMAGENS_PRODUTOS}" não encontrado no Supabase Storage. Crie o bucket ou ajuste SUPABASE_PRODUTOS_BUCKET/.env.local.`
          )
        }
        throw new Error(`Falha ao enviar nova imagem do produto: ${uploadError.message}`)
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_IMAGENS_PRODUTOS)
        .getPublicUrl(caminhoImagemUpload)

      if (!publicUrlData?.publicUrl) {
        throw new Error('Falha ao gerar URL pública da nova imagem do produto.')
      }

      imagemUrl = publicUrlData.publicUrl
    }

    const { error: updateError } = await supabase
      .from('itens_cardapio')
      .update({
        nome: dados.nome,
        descricao: dados.descricao || null,
        preco_venda: dados.preco_venda,
        imagem_url: imagemUrl,
        disponivel: dados.disponivel
      })
      .eq('id', itemId)

    if (updateError) throw updateError

    const { error: deleteFichaError } = await supabase
      .from('composicao_produto')
      .delete()
      .eq('item_cardapio_id', itemId)

    if (deleteFichaError) throw deleteFichaError

    const insumosFiltrados = Object.entries(dados.fichaTecnica).filter(([, qtd]) => parseFloat(qtd) > 0)

    if (insumosFiltrados.length > 0) {
      const composicaoInserts = insumosFiltrados.map(([insumoId, qtd]) => ({
        item_cardapio_id: itemId,
        insumo_id: insumoId,
        quantidade_necessaria: parseFloat(qtd)
      }))

      const { error: compError } = await supabase
        .from('composicao_produto')
        .insert(composicaoInserts)

      if (compError) throw compError
    }

    const { error: deleteComplementosError } = await supabase
      .from('complementos_produto')
      .delete()
      .eq('item_cardapio_id', itemId)

    if (deleteComplementosError) throw deleteComplementosError

    if (dados.adicionais.length > 0) {
      const complementosInserts = dados.adicionais.map(adicional => ({
        item_cardapio_id: itemId,
        nome: adicional.nome,
        preco_adicional: adicional.preco,
        disponivel: true
      }))

      const { error: complError } = await supabase
        .from('complementos_produto')
        .insert(complementosInserts)

      if (complError) throw complError
    }

    revalidatePath(`/${slug}`)
    revalidatePath('/admin/produtos')

    return { success: true }
  } catch (error: unknown) {
    if (caminhoImagemUpload) {
      await supabase.storage
        .from(BUCKET_IMAGENS_PRODUTOS)
        .remove([caminhoImagemUpload])
    }

    const message = getErrorMessage(error)
    console.error('[SERVER ACTION ERROR] Falha ao atualizar produto:', error)
    return { success: false, error: message }
  }
}

export async function atualizarOrdemItensCardapio(idsOrdenados: string[]) {
  const supabase = await createClient()

  try {
    const { restauranteId, slug } = await obterContextoGestorLogado(supabase)

    const { data: itensDoRestaurante, error: itensError } = await supabase
      .from('itens_cardapio')
      .select('id')
      .eq('restaurante_id', restauranteId)

    if (itensError) throw itensError

    const idsValidos = new Set((itensDoRestaurante ?? []).map((item) => item.id as string))
    const todosValidos = idsOrdenados.every((id) => idsValidos.has(id))

    if (!todosValidos || idsOrdenados.length === 0) {
      throw new Error('Itens inválidos para este restaurante.')
    }

    const resultados = await Promise.all(
      idsOrdenados.map((id, indice) =>
        supabase.from('itens_cardapio').update({ ordem: indice }).eq('id', id)
      )
    )

    const primeiroErro = resultados.find((resultado) => resultado.error)
    if (primeiroErro?.error) throw primeiroErro.error

    revalidatePath(`/${slug}`)
    revalidatePath('/admin/produtos')

    return { success: true }
  } catch (error: unknown) {
    const message = getErrorMessage(error)
    console.error('[SERVER ACTION ERROR] Falha ao reordenar cardápio:', error)
    return { success: false, error: message }
  }
}

export async function obterCardapioPorSlug(slug: string) {
  const supabase = await createClient()
  const slugNormalizado = slug.trim()

  if (!slugNormalizado) {
    return { restaurante: null, produtos: [] }
  }

  const { data: restaurante, error: erroRestaurante } = await supabase
    .from('restaurantes')
    .select('id, nome, tipo, endereco, logo_url, horarios_funcionamento')
    .eq('slug', slugNormalizado)
    .maybeSingle()

  if (erroRestaurante || !restaurante) {
    console.error('Erro ao localizar restaurante pelo slug:', erroRestaurante)
    return { restaurante: null, produtos: [] }
  }

  const hoje = new Date().toISOString().split('T')[0]
  const { error: erroFunil } = await supabase.rpc('incrementar_visitas_funil', {
    p_restaurante_id: restaurante.id,
    p_data: hoje,
  })
  if (erroFunil) {
    console.error('Falha ao registrar visita no funil de métricas:', erroFunil)
  }

  const { data: produtos, error: erroProdutos } = await supabase
    .from('itens_cardapio')
    .select(`
      id,
      restaurante_id,
      nome,
      descricao,
      preco_venda,
      imagem_url,
      disponivel,
      created_at,
      complementos_produto (
        id,
        item_cardapio_id,
        nome,
        preco_adicional,
        disponivel,
        created_at,
        grupo
      )
    `)
    .eq('restaurante_id', restaurante.id)
    .eq('disponivel', true)
    .order('ordem', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (erroProdutos) {
    console.error('Erro ao buscar itens e complementos do cardápio:', erroProdutos)
    return { restaurante, produtos: [] }
  }

  return {
    restaurante,
    produtos: produtos || []
  }
}
