'use client';

interface BotaoLocalizacaoGpsProps {
  onCapturarLocalizacao: () => void;
  /** texto do botão (padrão: "Detectar Minha Localização Atual") */
  rotulo?: string;
}

export default function BotaoLocalizacaoGps({ onCapturarLocalizacao, rotulo = 'Detectar Minha Localização Atual' }: BotaoLocalizacaoGpsProps) {
  return (
    <button
      type="button"
      onClick={onCapturarLocalizacao}
      className="w-full py-3 border border-dashed border-zinc-200 rounded-[14px] flex items-center justify-center gap-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-all active:scale-[0.99]"
    >
      <svg className="w-4 h-4 text-[#E16349]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      {rotulo}
    </button>
  );
}
