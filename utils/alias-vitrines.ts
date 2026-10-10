// Vitrines alternativas ("versões de design") de uma mesma loja.
//
// O slug da URL escolhe o visual da vitrine, mas a loja de verdade é outra: cardápio, carrinho,
// checkout e pedidos continuam sendo os da loja real. Assim dá para comparar designs com o
// cardápio de verdade, sem duplicar loja nem separar pedidos.
//
// Para criar mais uma versão: inclua o slug aqui e registre o componente em
// components/ecommerce/temas/LojaPublicaDinamica.tsx e SeletorLojaPublica.tsx.

const SLUG_REAL_POR_ALIAS: Readonly<Record<string, string>> = {
  'perucho-burguer-v2': 'perucho-burguer',
  'perucho-burguer-v3': 'perucho-burguer',
};

/** Slug da loja real por trás da URL (o próprio slug quando não é uma versão alternativa). */
export function resolverSlugLoja(slug: string | null | undefined): string {
  const limpo = (slug ?? '').trim();
  return SLUG_REAL_POR_ALIAS[limpo] ?? limpo;
}

/** true quando o slug é só um visual alternativo de outra loja. */
export function ehVitrineAlternativa(slug: string | null | undefined): boolean {
  return Boolean(SLUG_REAL_POR_ALIAS[(slug ?? '').trim()]);
}
