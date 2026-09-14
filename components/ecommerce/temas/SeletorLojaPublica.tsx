import type { ComponentType, ReactElement } from 'react';
import type { ItemCardapio } from '@/types/database';
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

export interface RestaurantePropsLoja {
  id: string;
  nome: string;
  endereco: string | null;
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
