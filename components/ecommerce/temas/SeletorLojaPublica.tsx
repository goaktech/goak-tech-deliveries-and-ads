import type { ReactElement } from 'react';
import type { ItemCardapio } from '@/types/database';
import type { HorarioFuncionamentoDia } from '@/utils/horario-funcionamento';
import { normalizarTipoRestaurante, type TipoRestaurante } from '@/utils/tipos-restaurante';
import { LojaPublicaDinamica, type ChaveTemaLoja } from '@/components/ecommerce/temas/LojaPublicaDinamica';

export interface RestaurantePropsLoja {
  id: string;
  nome: string;
  endereco: string | null;
  /** Opcional: só as vitrines que mostram tarja de horário (ex.: V3 da Cantina Brasil) usam isso. */
  horariosFuncionamento?: HorarioFuncionamentoDia[] | null;
  /** Opcional: foto de capa cadastrada pelo gestor (Configurações da loja). Só o Perucho Burguer usa isso por enquanto. */
  fotoCapaUrl?: string | null;
}

export interface ComponenteLojaProps {
  restaurante: RestaurantePropsLoja;
  produtos: ItemCardapio[];
}

const SLUGS_CUSTOMIZADOS: ReadonlySet<string> = new Set([
  'geovanna-acaiteria',
  'pastel-e-cia',
  'nami-sushi-bar',
  'naturaz',
  'wcs-acaiteria',
  'godog',
  'cantina-brasil',
  'cantina-brasil-v2',
  'cantina-brasil-v3',
  'perucho-burguer',
  'perucho-burguer-v2',
  'perucho-burguer-v3',
]);

const TIPOS_COM_TEMA: ReadonlySet<TipoRestaurante> = new Set<TipoRestaurante>([
  'ACAITERIA',
  'HAMBURGUERIA',
  'SORVETERIA',
  'SUSHI_BAR',
  'FITNESS_SAUDAVEL',
  'RESTAURANTE_TRADICIONAL',
]);

function obterChaveTemaLoja(slug: string, tipo: string | null | undefined): ChaveTemaLoja {
  if (SLUGS_CUSTOMIZADOS.has(slug)) {
    return slug as ChaveTemaLoja;
  }

  const tipoNormalizado = normalizarTipoRestaurante(tipo);
  return TIPOS_COM_TEMA.has(tipoNormalizado) ? (tipoNormalizado as ChaveTemaLoja) : 'HAMBURGUERIA';
}

export function renderizarLojaPublica(props: {
  slug: string;
  tipo: string | null | undefined;
  restaurante: RestaurantePropsLoja;
  produtos: ItemCardapio[];
}): ReactElement {
  const chave = obterChaveTemaLoja(props.slug, props.tipo);
  return <LojaPublicaDinamica chave={chave} restaurante={props.restaurante} produtos={props.produtos} />;
}
