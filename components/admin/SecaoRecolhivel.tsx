'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

const TELA_LARGA = '(min-width: 768px)';

function assinarTamanhoDaTela(aviso: () => void) {
  const consulta = window.matchMedia(TELA_LARGA);
  consulta.addEventListener('change', aviso);
  return () => consulta.removeEventListener('change', aviso);
}

interface SecaoRecolhivelProps {
  id: string;
  titulo: string;
  /** Selo de estado (ex.: "Conectado") mostrado ao lado do título, mesmo com a seção fechada. */
  selo?: ReactNode;
  children: ReactNode;
}

/**
 * Seção de integração que abre e fecha. No celular começa fechada (a página era longa demais); no
 * desktop e tablet começa aberta. Depois que o gestor clica, vale a escolha dele.
 */
export function SecaoRecolhivel({ id, titulo, selo, children }: SecaoRecolhivelProps) {
  const telaLarga = useSyncExternalStore(
    assinarTamanhoDaTela,
    () => window.matchMedia(TELA_LARGA).matches,
    () => false
  );
  const [escolha, setEscolha] = useState<boolean | null>(null);
  const aberta = escolha ?? telaLarga;

  // Os atalhos do resumo no topo apontam para #id: abrem a seção correspondente.
  useEffect(() => {
    const abrirSeHashForEstaSecao = () => {
      if (window.location.hash === `#${id}`) setEscolha(true);
    };
    window.addEventListener('hashchange', abrirSeHashForEstaSecao);
    return () => window.removeEventListener('hashchange', abrirSeHashForEstaSecao);
  }, [id]);

  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => setEscolha(!aberta)}
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
