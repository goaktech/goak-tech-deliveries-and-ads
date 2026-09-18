import type { ComponentType, ReactElement } from 'react';
import type { ItemCardapio } from '@/types/database';
import type { HorarioFuncionamentoDia } from '@/utils/horario-funcionamento';
import { normalizarTipoRestaurante, type TipoRestaurante } from '@/utils/tipos-restaurante';
import ComponenteLojaHamburguer from '@/components/ecommerce/ComponenteLojaHamburguer';
import ComponenteLojaAcai from '@/components/ecommerce/ComponenteLojaAcai';
import ComponenteLojaSorveteria from '@/components/ecommerce/ComponenteLojaSorveteria';
import ComponenteLojaSushiBar from '@/components/ecommerce/ComponenteLojaSushiBar';
import ComponenteLojaFitness from '@/components/ecommerce/ComponenteLojaFitness';
import ComponenteLojaRestauranteTradicional from '@/components/ecommerce/ComponenteLojaRestauranteTradicional';
import ComponenteLojaGeovannaAcaiteria from '@/components/ecommerce/lojas/ComponenteLojaGeovannaAcaiteria';
import ComponenteLojaPastelECia from '@/components/ecommerce/lojas/ComponenteLojaPastelECia';
import ComponenteLojaNamiSushiBar from '@/components/ecommerce/lojas/ComponenteLojaNamiSushiBar';
import ComponenteLojaNaturaz from '@/components/ecommerce/lojas/ComponenteLojaNaturaz';
import ComponenteLojaWcsAcaiteria from '@/components/ecommerce/lojas/ComponenteLojaWcsAcaiteria';
import ComponenteLojaGoDog from '@/components/ecommerce/lojas/ComponenteLojaGoDog';
import ComponenteLojaCantinaBrasil from '@/components/ecommerce/lojas/ComponenteLojaCantinaBrasil';
import ComponenteLojaCantinaBrasilV2 from '@/components/ecommerce/lojas/ComponenteLojaCantinaBrasilV2';
import ComponenteLojaCantinaBrasilV3 from '@/components/ecommerce/lojas/ComponenteLojaCantinaBrasilV3';
import ComponenteLojaPeruchoBurguer from '@/components/ecommerce/lojas/ComponenteLojaPeruchoBurguer';
import ComponenteLojaPeruchoBurguerV2 from '@/components/ecommerce/lojas/ComponenteLojaPeruchoBurguerV2';

export interface RestaurantePropsLoja {
  id: string;
  nome: string;
  endereco: string | null;
  /** Opcional: só as vitrines que mostram tarja de horário (ex.: V3 da Cantina Brasil) usam isso. */
  horariosFuncionamento?: HorarioFuncionamentoDia[] | null;
}

export interface ComponenteLojaProps {
  restaurante: RestaurantePropsLoja;
  produtos: ItemCardapio[];
}

type ComponenteLoja = ComponentType<ComponenteLojaProps>;

const LOJAS_CUSTOMIZADAS: Record<string, ComponenteLoja> = {
  'geovanna-acaiteria': ComponenteLojaGeovannaAcaiteria,
  'pastel-e-cia': ComponenteLojaPastelECia,
  'nami-sushi-bar': ComponenteLojaNamiSushiBar,
  naturaz: ComponenteLojaNaturaz,
  'wcs-acaiteria': ComponenteLojaWcsAcaiteria,
  godog: ComponenteLojaGoDog,
  'cantina-brasil': ComponenteLojaCantinaBrasil,
  'cantina-brasil-v2': ComponenteLojaCantinaBrasilV2,
  'cantina-brasil-v3': ComponenteLojaCantinaBrasilV3,
  'perucho-burguer': ComponenteLojaPeruchoBurguer,
  'perucho-burguer-v2': ComponenteLojaPeruchoBurguerV2,
};

const TEMPLATES_POR_TIPO: Partial<Record<TipoRestaurante, ComponenteLoja>> = {
  ACAITERIA: ComponenteLojaAcai,
  HAMBURGUERIA: ComponenteLojaHamburguer,
  SORVETERIA: ComponenteLojaSorveteria,
  SUSHI_BAR: ComponenteLojaSushiBar,
  FITNESS_SAUDAVEL: ComponenteLojaFitness,
  RESTAURANTE_TRADICIONAL: ComponenteLojaRestauranteTradicional,
};

function obterComponenteLojaPublica(slug: string, tipo: string | null | undefined): ComponenteLoja {
  const componenteCustomizado = LOJAS_CUSTOMIZADAS[slug];
  if (componenteCustomizado) {
    return componenteCustomizado;
  }

  const tipoNormalizado = normalizarTipoRestaurante(tipo);
  return TEMPLATES_POR_TIPO[tipoNormalizado] ?? ComponenteLojaHamburguer;
}

export function renderizarLojaPublica(props: {
  slug: string;
  tipo: string | null | undefined;
  restaurante: RestaurantePropsLoja;
  produtos: ItemCardapio[];
}): ReactElement {
  const Componente = obterComponenteLojaPublica(props.slug, props.tipo);
  return <Componente restaurante={props.restaurante} produtos={props.produtos} />;
}
