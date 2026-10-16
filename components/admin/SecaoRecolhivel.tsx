'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface SecaoRecolhivelProps {
  id: string;
  titulo: string;
  selo?: ReactNode;
  abertaInicialmente?: boolean;
  children: ReactNode;
}

export function SecaoRecolhivel({ id, titulo, selo, abertaInicialmente = false, children }: SecaoRecolhivelProps) {
  const [aberta, setAberta] = useState(abertaInicialmente);

  useEffect(() => {
    const abrirSeHashForEstaSecao = () => {
      if (window.location.hash === `#${id}`) setAberta(true);
    };
    window.addEventListener('hashchange', abrirSeHashForEstaSecao);
    return () => window.removeEventListener('hashchange', abrirSeHashForEstaSecao);
  }, [id]);

  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => setAberta((atual) => !atual)}
        aria-expanded={aberta}
        aria-controls={`${id}-conteudo`}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left"
      >
        <span className="min-w-0 truncate text-sm font-bold text-zinc-900">{titulo}</span>
        <span className="flex shrink-0 items-center gap-3">
          {selo}
          <svg
            className={`h-4 w-4 text-zinc-400 transition-transform ${aberta ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </button>
      <div id={`${id}-conteudo`} hidden={!aberta} className="space-y-4 px-3 pb-3 [&>div]:rounded-xl [&>div]:border-zinc-100">
        {children}
      </div>
    </section>
  );
}
