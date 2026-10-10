'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { ComponenteLojaProps } from '@/components/ecommerce/temas/SeletorLojaPublica';

type ComponenteLoja = ComponentType<ComponenteLojaProps>;

// Cada tema vira um arquivo separado: o visitante baixa só o da loja que abriu (a renderização no servidor continua igual).
export const TEMAS_DE_LOJA = {
  'geovanna-acaiteria': dynamic(() => import('@/components/ecommerce/lojas/ComponenteLojaGeovannaAcaiteria')),
  'pastel-e-cia': dynamic(() => import('@/components/ecommerce/lojas/ComponenteLojaPastelECia')),
  'nami-sushi-bar': dynamic(() => import('@/components/ecommerce/lojas/ComponenteLojaNamiSushiBar')),
  naturaz: dynamic(() => import('@/components/ecommerce/lojas/ComponenteLojaNaturaz')),
  'wcs-acaiteria': dynamic(() => import('@/components/ecommerce/lojas/ComponenteLojaWcsAcaiteria')),
  godog: dynamic(() => import('@/components/ecommerce/lojas/ComponenteLojaGoDog')),
  'cantina-brasil': dynamic(() => import('@/components/ecommerce/lojas/ComponenteLojaCantinaBrasil')),
  'cantina-brasil-v2': dynamic(() => import('@/components/ecommerce/lojas/ComponenteLojaCantinaBrasilV2')),
  'cantina-brasil-v3': dynamic(() => import('@/components/ecommerce/lojas/ComponenteLojaCantinaBrasilV3')),
  'perucho-burguer': dynamic(() => import('@/components/ecommerce/lojas/ComponenteLojaPeruchoBurguer')),
  // v2 e v3 são visuais alternativos da mesma loja (ver utils/alias-vitrines.ts).
  'perucho-burguer-v2': dynamic(() => import('@/components/ecommerce/lojas/ComponenteLojaPeruchoBurguerMercado')),
  'perucho-burguer-v3': dynamic(() => import('@/components/ecommerce/lojas/ComponenteLojaPeruchoBurguerParrilla')),
  ACAITERIA: dynamic(() => import('@/components/ecommerce/ComponenteLojaAcai')),
  HAMBURGUERIA: dynamic(() => import('@/components/ecommerce/ComponenteLojaHamburguer')),
  SORVETERIA: dynamic(() => import('@/components/ecommerce/ComponenteLojaSorveteria')),
  SUSHI_BAR: dynamic(() => import('@/components/ecommerce/ComponenteLojaSushiBar')),
  FITNESS_SAUDAVEL: dynamic(() => import('@/components/ecommerce/ComponenteLojaFitness')),
  RESTAURANTE_TRADICIONAL: dynamic(() => import('@/components/ecommerce/ComponenteLojaRestauranteTradicional')),
} satisfies Record<string, ComponenteLoja>;

export type ChaveTemaLoja = keyof typeof TEMAS_DE_LOJA;

export function LojaPublicaDinamica({ chave, ...props }: ComponenteLojaProps & { chave: ChaveTemaLoja }) {
  const Tema = TEMAS_DE_LOJA[chave];
  return <Tema {...props} />;
}
