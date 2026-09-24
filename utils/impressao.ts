export type LarguraPapelImpressao = 58 | 80;

export const LARGURAS_PAPEL_IMPRESSAO: LarguraPapelImpressao[] = [58, 80];

export const LARGURA_PAPEL_PADRAO: LarguraPapelImpressao = 80;

export function normalizarLarguraPapel(valor: unknown): LarguraPapelImpressao {
  return Number(valor) === 58 ? 58 : LARGURA_PAPEL_PADRAO;
}

export function ehLarguraPapelValida(valor: unknown): valor is LarguraPapelImpressao {
  return valor === 58 || valor === 80;
}
