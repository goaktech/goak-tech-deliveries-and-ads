import { NOMES_DIAS_SEMANA, obterDiaSemanaAtualBrasil } from '@/utils/horario-funcionamento';

export type CategoriaCantina = 'PRATOS' | 'ACOMPANHAMENTOS' | 'BEBIDAS' | 'SOBREMESAS';

interface ProdutoParaCategorizar {
  nome: string;
  categoria?: string | null;
}

const SINONIMOS_CATEGORIA: Record<string, CategoriaCantina> = {
  PRATO: 'PRATOS',
  PRATOS: 'PRATOS',
  'PRATO DO DIA': 'PRATOS',
  'PRATOS DO DIA': 'PRATOS',
  MARMITA: 'PRATOS',
  MARMITAS: 'PRATOS',
  ACOMPANHAMENTO: 'ACOMPANHAMENTOS',
  ACOMPANHAMENTOS: 'ACOMPANHAMENTOS',
  BEBIDA: 'BEBIDAS',
  BEBIDAS: 'BEBIDAS',
  SOBREMESA: 'SOBREMESAS',
  SOBREMESAS: 'SOBREMESAS',
  DOCE: 'SOBREMESAS',
  DOCES: 'SOBREMESAS',
};

function categoriaPorNome(nome: string): CategoriaCantina {
  if (/sobremesa|doce|pudim|sorvete|mousse|brigadeiro|bolo/i.test(nome)) return 'SOBREMESAS';
  if (/suco|refrigerante|água|bebida|cerveja|drink|vinho|guaraná|coca/i.test(nome)) return 'BEBIDAS';
  if (/acompanhamento|arroz|farofa|salada|purê|fritas|couve|vinagrete/i.test(nome)) return 'ACOMPANHAMENTOS';
  return 'PRATOS';
}

export function categoriaDoProduto(produto: ProdutoParaCategorizar): CategoriaCantina {
  const categoriaNormalizada = (produto.categoria ?? '').trim().toUpperCase();
  const categoriaConhecida = SINONIMOS_CATEGORIA[categoriaNormalizada];
  return categoriaConhecida ?? categoriaPorNome(produto.nome);
}

interface ProdutoComDia {
  dia_semana?: number | null;
}

export function produtoDisponivelHoje(produto: ProdutoComDia, agora = new Date()): boolean {
  if (produto.dia_semana === null || produto.dia_semana === undefined) return true;
  return produto.dia_semana === obterDiaSemanaAtualBrasil(agora);
}

export function rotuloDiaSemana(dia: number): string {
  return NOMES_DIAS_SEMANA[dia] ?? '';
}
