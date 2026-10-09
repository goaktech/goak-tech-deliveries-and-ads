import { createClient } from '@supabase/supabase-js';
import { revalidateTag, unstable_cache } from 'next/cache';
import { obterRestauranteCabecalhoAdmin } from '@/utils/admin-auth';

/** Por quanto tempo a vitrine pode reaproveitar os dados quando ninguém avisou que algo mudou (segundos). */
const SEGUNDOS_DE_SEGURANCA = 60;

export const ERRO_VITRINE_NAO_ENCONTRADA = 'VITRINE_NAO_ENCONTRADA';

export function tagVitrine(slug: string) {
  return `vitrine:${slug.trim()}`;
}

/** Cliente sem cookies (visitante anônimo): necessário porque o cache não pode depender de quem está logado. */
export function criarClienteAnonimoVitrine() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** Joga fora o que está guardado da vitrine desta loja: a próxima visita já busca dados novos. */
export function invalidarVitrine(slug: string | null | undefined) {
  if (!slug) return;
  revalidateTag(tagVitrine(slug), { expire: 0 });
}

/** Mesma coisa, descobrindo a loja pelo gestor logado. Nunca derruba a ação que o chamou. */
export async function invalidarVitrineDoGestorLogado() {
  try {
    const restaurante = await obterRestauranteCabecalhoAdmin();
    invalidarVitrine(restaurante?.slug);
  } catch (erro) {
    console.error('Falha ao invalidar o cache da vitrine:', erro);
  }
}

async function buscarDadosVitrine(slug: string) {
  const supabase = criarClienteAnonimoVitrine();

  const { data: restaurante, error: erroRestaurante } = await supabase
    .from('restaurantes')
    .select('id, nome, tipo, endereco, logo_url, foto_capa_url, horarios_funcionamento, meta_pixel_id')
    .eq('slug', slug)
    .maybeSingle();

  // Erros e loja inexistente são lançados (e não retornados) para nunca ficarem guardados no cache.
  if (erroRestaurante) throw erroRestaurante;
  if (!restaurante) throw new Error(ERRO_VITRINE_NAO_ENCONTRADA);

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
      categoria,
      dia_semana,
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
    .order('created_at', { ascending: true });

  if (erroProdutos) throw erroProdutos;

  return { restaurante, produtos: produtos ?? [] };
}

export function obterDadosVitrineEmCache(slug: string) {
  return unstable_cache(() => buscarDadosVitrine(slug), ['vitrine-dados', slug], {
    tags: [tagVitrine(slug)],
    revalidate: SEGUNDOS_DE_SEGURANCA,
  })();
}

async function buscarPixelVitrine(slug: string): Promise<string | null> {
  const { data, error } = await criarClienteAnonimoVitrine()
    .from('restaurantes')
    .select('meta_pixel_id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data?.meta_pixel_id ?? null;
}

/** Só o ID do Pixel (usado no layout da loja, que também envolve checkout e acompanhamento). */
export async function obterPixelIdVitrineEmCache(slug: string): Promise<string | null> {
  try {
    return await unstable_cache(() => buscarPixelVitrine(slug), ['vitrine-pixel', slug], {
      tags: [tagVitrine(slug)],
      revalidate: SEGUNDOS_DE_SEGURANCA,
    })();
  } catch (erro) {
    console.error('Falha ao buscar o Pixel da loja:', erro);
    return null;
  }
}
