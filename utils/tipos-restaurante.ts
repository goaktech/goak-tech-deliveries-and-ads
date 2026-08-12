
export const TIPOS_RESTAURANTE = [
  'ACAITERIA',
  'HAMBURGUERIA',
  'PIZZARIA',
  'RESTAURANTE_TRADICIONAL',
  'CAFETERIA_DOCERIA',
  'SORVETERIA',
  'SUSHI_BAR',
  'FITNESS_SAUDAVEL',
  'PASTELARIA',
  'ESPETARIA',
] as const;

export type TipoRestaurante = (typeof TIPOS_RESTAURANTE)[number];

export const ROTULO_TIPO_RESTAURANTE: Record<TipoRestaurante, string> = {
  ACAITERIA: 'Açaiteria',
  HAMBURGUERIA: 'Hamburgueria',
  PIZZARIA: 'Pizzaria',
  RESTAURANTE_TRADICIONAL: 'Restaurante tradicional',
  CAFETERIA_DOCERIA: 'Cafeteria/doceria',
  SORVETERIA: 'Sorveteria',
  SUSHI_BAR: 'Sushi bar',
  FITNESS_SAUDAVEL: 'Comida fitness/saudável',
  PASTELARIA: 'Pastelaria',
  ESPETARIA: 'Espetaria',
};

export const TIPO_RESTAURANTE_PADRAO: TipoRestaurante = 'HAMBURGUERIA';

export function normalizarTipoRestaurante(tipo: string | null | undefined): TipoRestaurante {
  const tipoNormalizado = (tipo ?? '').trim().toUpperCase();
  const encontrado = TIPOS_RESTAURANTE.find((candidato) => candidato === tipoNormalizado);
  return encontrado ?? TIPO_RESTAURANTE_PADRAO;
}
