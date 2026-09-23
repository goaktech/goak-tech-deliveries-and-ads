'use client';

import type { AvisoCozinha as DadosAvisoCozinha } from '@/app/(dashboard)/admin/cozinha/useCozinha';

interface AvisoCozinhaProps {
  aviso: DadosAvisoCozinha | null;
  onDesfazer: (pedidoId: string) => void;
  onFechar: () => void;
}

export function AvisoCozinha({ aviso, onDesfazer, onFechar }: AvisoCozinhaProps) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
      {aviso && (
        <div
          key={aviso.chave}
          role={aviso.tipo === 'erro' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl py-2 pl-4 pr-2 shadow-xl ${
            aviso.tipo === 'erro' ? 'bg-red-700 text-white' : 'bg-[#1A1A1A] text-white'
          }`}
        >
          <span className="text-xs font-medium leading-snug">{aviso.texto}</span>
          {aviso.pedidoIdDesfazer ? (
            <button
              type="button"
              onClick={() => onDesfazer(aviso.pedidoIdDesfazer!)}
              className="h-9 shrink-0 rounded-xl bg-white/15 px-3 text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-white/25"
            >
              Desfazer
            </button>
          ) : (
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar aviso"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
