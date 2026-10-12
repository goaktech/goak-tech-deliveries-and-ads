import type { ItemCardapio } from '@/types/database';

export const NOME_MARCA = 'Dona Fit';
export const SLOGAN_MARCA = 'Alimentação saudável';

export interface Macros {
  proteinas: string | null;
  carboidratos: string | null;
  kcal: string | null;
}

export interface GrupoCategoria {
  nome: string;
  id: string;
  produtos: ItemCardapio[];
}

const CATEGORIAS_IMEDIATAS = /bebida|suco|sobremesa|pro\s*500/i;

export function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ehSobEncomenda(categoria: string) {
  return !CATEGORIAS_IMEDIATAS.test(categoria);
}

export function idDaCategoria(nome: string) {
  return (
    'cat-' +
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

export function agruparPorCategoria(produtos: ItemCardapio[]): GrupoCategoria[] {
  const mapa = new Map<string, ItemCardapio[]>();
  for (const produto of produtos) {
    const nome = produto.categoria?.trim() || 'Cardápio';
    const lista = mapa.get(nome);
    if (lista) lista.push(produto);
    else mapa.set(nome, [produto]);
  }
  return Array.from(mapa, ([nome, lista]) => ({ nome, id: idDaCategoria(nome), produtos: lista }));
}

function capturar(texto: string, rotulo: RegExp) {
  const achado = texto.match(rotulo);
  return achado ? achado[1] : null;
}

export function extrairMacros(descricao: string | null | undefined): { macros: Macros | null; texto: string } {
  const original = (descricao ?? '').trim();
  if (!original) return { macros: null, texto: '' };

  const proteinas = capturar(original, /prote[ií]nas?\s*:\s*(\d+(?:[.,]\d+)?)/i);
  const carboidratos = capturar(original, /carboidratos?\s*:\s*(\d+(?:[.,]\d+)?)/i);
  const kcal = capturar(original, /kcal\s*:\s*(\d+(?:[.,]\d+)?)/i);

  if (!proteinas && !carboidratos && !kcal) return { macros: null, texto: original };

  const texto = original
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha && !/^(prote[ií]nas?|carboidratos?|kcal)\s*:/i.test(linha))
    .join(' ');

  return { macros: { proteinas, carboidratos, kcal }, texto };
}

export function etiquetasDoProduto(nome: string): string[] {
  const etiquetas: string[] = [];
  if (/vegano/i.test(nome)) etiquetas.push('Vegano');
  else if (/vegetarian/i.test(nome)) etiquetas.push('Vegetariano');
  if (/low\s*carb/i.test(nome)) etiquetas.push('Low carb');
  return etiquetas;
}

export function descreverMacros(macros: Macros) {
  const partes: string[] = [];
  if (macros.proteinas) partes.push(`${macros.proteinas}g proteína`);
  if (macros.carboidratos) partes.push(`${macros.carboidratos}g carbo`);
  if (macros.kcal) partes.push(`${macros.kcal} kcal`);
  return partes.join(' · ');
}
