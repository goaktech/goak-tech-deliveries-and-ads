/**
 * Estilos de botão e selo do painel do gestor, num só lugar, para as telas ficarem iguais.
 * Todos têm altura mínima de 44 px no celular (alvo de toque) e voltam ao tamanho compacto no desktop.
 */
const BASE_BOTAO =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9';

export const estilosPainel = {
  botaoPrimario: `${BASE_BOTAO} bg-[#E16349] text-white hover:bg-[#c8523a]`,
  botaoEscuro: `${BASE_BOTAO} bg-[#1A1A1A] text-white hover:bg-zinc-800`,
  botaoSecundario: `${BASE_BOTAO} border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:text-[#1A1A1A]`,
  botaoPerigo: `${BASE_BOTAO} border border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100`,
  seloSucesso:
    'rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600',
  seloAlerta:
    'rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700',
  seloErro: 'rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-red-600',
} as const;
