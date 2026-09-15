// Regras de cardápio compartilhadas pelas vitrines da Cantina Brasil
// (ComponenteLojaCantinaBrasil e ComponenteLojaCantinaBrasilV2), pra evitar
// que a categorização e a liberação por dia da semana fiquem divergentes
// entre as duas versões visuais.

import { NOMES_DIAS_SEMANA, obterDiaSemanaAtualBrasil } from '@/utils/horario-funcionamento';

export type CategoriaCantina = 'PRATOS' | 'ACOMPANHAMENTOS' | 'BEBIDAS' | 'SOBREMESAS';

interface ProdutoParaCategorizar {
  nome: string;
  categoria?: string | null;
}

// Sinônimos aceitos no campo livre `categoria` (cadastrado no admin). Tudo
// que não bater com nenhum sinônimo cai na heurística antiga (por nome), pra
// não quebrar itens cadastrados antes desse campo existir.
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

/**
 * Categoria estrutural do produto: usa o campo `categoria` cadastrado no
 * admin quando ele bate com um sinônimo conhecido; caso contrário, cai na
 * heurística antiga (adivinhar pelo nome) — assim itens ainda não
 * categorizados continuam aparecendo no lugar certo.
 */
export function categoriaDoProduto(produto: ProdutoParaCategorizar): CategoriaCantina {
  const categoriaNormalizada = (produto.categoria ?? '').trim().toUpperCase();
  const categoriaConhecida = SINONIMOS_CATEGORIA[categoriaNormalizada];
  return categoriaConhecida ?? categoriaPorNome(produto.nome);
}

interface ProdutoComDia {
  dia_semana?: number | null;
}

/**
 * Cada prato é servido em 1 dia fixo (`dia_semana`, 0=Domingo..6=Sábado).
 * Sem essa marcação (null/undefined), o item fica liberado todos os dias —
 * é o comportamento padrão pra acompanhamentos, bebidas, sobremesas e
 * qualquer prato ainda não configurado.
 */
export function produtoDisponivelHoje(produto: ProdutoComDia, agora = new Date()): boolean {
  if (produto.dia_semana === null || produto.dia_semana === undefined) return true;
  return produto.dia_semana === obterDiaSemanaAtualBrasil(agora);
}

/** Nome do dia (ex.: "terça-feira") pro texto "Disponível às terças". */
export function rotuloDiaSemana(dia: number): string {
  return NOMES_DIAS_SEMANA[dia] ?? '';
}
