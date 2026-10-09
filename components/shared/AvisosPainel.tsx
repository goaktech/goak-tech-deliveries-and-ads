'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type TipoAviso = 'info' | 'sucesso' | 'erro';

export interface OpcoesConfirmacao {
  titulo: string;
  mensagem?: string;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  /** Pinta o botão de confirmar de vermelho (apagar, desconectar...). */
  perigo?: boolean;
}

interface AvisosPainelContexto {
  confirmar: (opcoes: OpcoesConfirmacao) => Promise<boolean>;
  avisar: (texto: string, tipo?: TipoAviso) => void;
}

const AvisosContext = createContext<AvisosPainelContexto | null>(null);

/** Sem o provedor (ex.: componente usado fora do painel), cai nos diálogos do navegador em vez de quebrar. */
const FALLBACK_NAVEGADOR: AvisosPainelContexto = {
  confirmar: async ({ titulo, mensagem }) => window.confirm(mensagem ? `${titulo}\n\n${mensagem}` : titulo),
  avisar: (texto) => window.alert(texto),
};

export function useAvisosPainel(): AvisosPainelContexto {
  return useContext(AvisosContext) ?? FALLBACK_NAVEGADOR;
}

interface ConfirmacaoPendente extends OpcoesConfirmacao {
  resolver: (confirmado: boolean) => void;
}

interface AvisoVisivel {
  chave: number;
  texto: string;
  tipo: TipoAviso;
}

const DURACAO_AVISO_MS = 5000;

export function AvisosPainelProvider({ children }: { children: ReactNode }) {
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoPendente | null>(null);
  const [aviso, setAviso] = useState<AvisoVisivel | null>(null);
  const contadorRef = useRef(0);
  const botaoCancelarRef = useRef<HTMLButtonElement | null>(null);

  const confirmar = useCallback(
    (opcoes: OpcoesConfirmacao) =>
      new Promise<boolean>((resolver) => {
        setConfirmacao({ ...opcoes, resolver });
      }),
    []
  );

  const avisar = useCallback((texto: string, tipo: TipoAviso = 'info') => {
    contadorRef.current += 1;
    setAviso({ chave: contadorRef.current, texto, tipo });
  }, []);

  const responder = useCallback((confirmado: boolean) => {
    setConfirmacao((atual) => {
      atual?.resolver(confirmado);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const temporizador = window.setTimeout(() => setAviso(null), DURACAO_AVISO_MS);
    return () => window.clearTimeout(temporizador);
  }, [aviso]);

  useEffect(() => {
    if (!confirmacao) return;
    // O foco começa no botão seguro (cancelar), para um Enter sem querer não apagar nada.
    botaoCancelarRef.current?.focus();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') responder(false);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [confirmacao, responder]);

  const valor = useMemo(() => ({ confirmar, avisar }), [confirmar, avisar]);

  return (
    <AvisosContext.Provider value={valor}>
      {children}

      {confirmacao && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-900/40 sm:items-center sm:p-6"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) responder(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-confirmacao-painel"
            aria-describedby={confirmacao.mensagem ? 'texto-confirmacao-painel' : undefined}
            className="flex w-full max-w-sm flex-col gap-4 rounded-t-3xl bg-white p-5 pb-8 shadow-xl sm:rounded-3xl sm:pb-5"
          >
            <div className="space-y-1.5">
              <h2 id="titulo-confirmacao-painel" className="text-base font-bold text-[#1A1A1A]">
                {confirmacao.titulo}
              </h2>
              {confirmacao.mensagem && (
                <p id="texto-confirmacao-painel" className="text-sm leading-snug text-zinc-500">
                  {confirmacao.mensagem}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                ref={botaoCancelarRef}
                type="button"
                onClick={() => responder(false)}
                className="min-h-11 flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                {confirmacao.rotuloCancelar ?? 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => responder(true)}
                className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-bold text-white transition ${
                  confirmacao.perigo ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1A1A1A] hover:bg-zinc-800'
                }`}
              >
                {confirmacao.rotuloConfirmar ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex justify-center px-3 md:bottom-6">
        {aviso && (
          <div
            key={aviso.chave}
            role={aviso.tipo === 'erro' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl py-2 pl-4 pr-2 text-white shadow-xl ${
              aviso.tipo === 'erro' ? 'bg-red-700' : aviso.tipo === 'sucesso' ? 'bg-emerald-700' : 'bg-[#1A1A1A]'
            }`}
          >
            <span className="text-xs font-medium leading-snug">{aviso.texto}</span>
            <button
              type="button"
              onClick={() => setAviso(null)}
              aria-label="Fechar aviso"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </AvisosContext.Provider>
  );
}
