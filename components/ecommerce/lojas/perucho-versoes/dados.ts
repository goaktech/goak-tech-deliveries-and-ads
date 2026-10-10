import type { ItemCardapio } from '@/types/database';
import { obterDiaSemanaAtualBrasil } from '@/utils/horario-funcionamento';

/* Regras de cardápio compartilhadas pelas versões de design do Perucho Burguer (v2 e v3). */

export type CategoriaVitrine = 'COMBOS' | 'HAMBURGUERES' | 'ENTRADAS' | 'BEBIDAS' | 'SOBREMESAS';

export const ORDEM_CATEGORIAS: { chave: CategoriaVitrine; rotulo: string }[] = [
  { chave: 'COMBOS', rotulo: 'Combos' },
  { chave: 'HAMBURGUERES', rotulo: 'Hambúrgueres' },
  { chave: 'ENTRADAS', rotulo: 'Entradas' },
  { chave: 'BEBIDAS', rotulo: 'Bebidas' },
  { chave: 'SOBREMESAS', rotulo: 'Sobremesas' },
];

const SINONIMOS_CATEGORIA: Record<string, CategoriaVitrine> = {
  COMBO: 'COMBOS',
  COMBOS: 'COMBOS',
  HAMBURGUER: 'HAMBURGUERES',
  HAMBÚRGUER: 'HAMBURGUERES',
  HAMBURGUERES: 'HAMBURGUERES',
  HAMBÚRGUERES: 'HAMBURGUERES',
  ENTRADA: 'ENTRADAS',
  ENTRADAS: 'ENTRADAS',
  PORCAO: 'ENTRADAS',
  PORÇÃO: 'ENTRADAS',
  PORCOES: 'ENTRADAS',
  PORÇÕES: 'ENTRADAS',
  ACOMPANHAMENTO: 'ENTRADAS',
  ACOMPANHAMENTOS: 'ENTRADAS',
  BEBIDA: 'BEBIDAS',
  BEBIDAS: 'BEBIDAS',
  SOBREMESA: 'SOBREMESAS',
  SOBREMESAS: 'SOBREMESAS',
  DOCE: 'SOBREMESAS',
  DOCES: 'SOBREMESAS',
};

function categoriaPorNome(nome: string): CategoriaVitrine {
  if (/^combo\b/i.test(nome.trim())) return 'COMBOS';
  if (/sobremesa|doce|pudim|sorvete|mousse|brownie|torta|petit ?gateau|cheesecake|picaron/i.test(nome)) return 'SOBREMESAS';
  if (/suco|refrigerante|água|bebida|cerveja|drink|guaran[aá]|coca|milkshake|chicha|inca ?kola/i.test(nome)) return 'BEBIDAS';
  if (/batata|anel de cebola|onion|nugget|porç[ãa]o|molho|crispy|isca/i.test(nome)) return 'ENTRADAS';
  return 'HAMBURGUERES';
}

/** Usa o campo `categoria` do cadastro; sem um sinônimo conhecido, cai numa heurística pelo nome. */
export function categoriaDoProduto(produto: Pick<ItemCardapio, 'nome' | 'categoria'>): CategoriaVitrine {
  const normalizada = (produto.categoria ?? '').trim().toUpperCase();
  return SINONIMOS_CATEGORIA[normalizada] ?? categoriaPorNome(produto.nome);
}

/** Sem `dia_semana` o item vale todo dia; com ele, só no dia certo. `disponivel === false` sempre bloqueia. */
export function produtoDisponivelHoje(produto: Pick<ItemCardapio, 'disponivel' | 'dia_semana'>, agora = new Date()): boolean {
  if (produto.disponivel === false) return false;
  if (produto.dia_semana === null || produto.dia_semana === undefined) return true;
  return produto.dia_semana === obterDiaSemanaAtualBrasil(agora);
}

export function formatarMoeda(valor: number): string {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function agruparPorCategoria(produtos: ItemCardapio[]) {
  return ORDEM_CATEGORIAS.map((categoria) => ({
    ...categoria,
    produtos: produtos.filter((produto) => categoriaDoProduto(produto) === categoria.chave),
  })).filter((grupo) => grupo.produtos.length > 0);
}
