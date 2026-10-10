'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ItemCardapio } from '@/types/database';
import { agruparPorCategoria, type CategoriaVitrine } from './dados';

/** Agrupa o cardápio por categoria e mantém a aba da categoria visível sincronizada com a rolagem. */
export function useVitrine(produtos: ItemCardapio[]) {
  const grupos = useMemo(() => agruparPorCategoria(produtos), [produtos]);
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaVitrine>(grupos[0]?.chave ?? 'HAMBURGUERES');
  const secoesRef = useRef<Partial<Record<CategoriaVitrine, HTMLElement>>>({});
  const abasRef = useRef<Partial<Record<CategoriaVitrine, HTMLElement>>>({});
  const barraAbasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const elementos = grupos
      .map((grupo) => secoesRef.current[grupo.chave])
      .filter((el): el is HTMLElement => Boolean(el));
    if (elementos.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (!entrada.isIntersecting) return;
          const chave = entrada.target.getAttribute('data-categoria') as CategoriaVitrine | null;
          if (chave) setCategoriaAtiva(chave);
        });
      },
      { rootMargin: '-25% 0px -70% 0px' }
    );
    elementos.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [grupos]);

  // centraliza a aba ativa dentro da barra horizontal (rola só a barra, nunca a página)
  useEffect(() => {
    const barra = barraAbasRef.current;
    const aba = abasRef.current[categoriaAtiva];
    if (!barra || !aba) return;
    barra.scrollTo({ left: Math.max(0, aba.offsetLeft - (barra.clientWidth - aba.offsetWidth) / 2), behavior: 'smooth' });
  }, [categoriaAtiva]);

  const irParaCategoria = (chave: CategoriaVitrine) => {
    setCategoriaAtiva(chave);
    secoesRef.current[chave]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return { grupos, categoriaAtiva, irParaCategoria, secoesRef, abasRef, barraAbasRef };
}
