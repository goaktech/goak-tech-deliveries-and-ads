const SLUG_REAL_POR_ALIAS: Readonly<Record<string, string>> = {
  'dona-fit-v2': 'dona-fit',
};

export function resolverSlugLoja(slug: string | null | undefined): string {
  const limpo = (slug ?? '').trim();
  return SLUG_REAL_POR_ALIAS[limpo] ?? limpo;
}

export function ehVitrineAlternativa(slug: string | null | undefined): boolean {
  return Boolean(SLUG_REAL_POR_ALIAS[(slug ?? '').trim()]);
}
