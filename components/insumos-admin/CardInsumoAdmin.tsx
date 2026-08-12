'use client';

import { Insumo } from '@/types/database';

interface CardProps {
  insumo: Insumo;
  isSelecionado: boolean;
  onToggleSelect: () => void;
  onEditarClick: (insumo: Insumo) => void;
  onExcluirClick: (insumo: Insumo) => void;
  isPending?: boolean;
}

export default function CardInsumoAdmin({
  insumo,
  isSelecionado,
  onToggleSelect,
  onEditarClick,
  onExcluirClick,
  isPending = false,
}: CardProps) {
  const estoqueCritico = Number(insumo.estoque_atual) <= Number(insumo.estoque_minimo);

  return (
    <div className={`group flex flex-col gap-4 rounded-2xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${
      isSelecionado ? 'border-[#E16349]/25 bg-orange-50/30' : 'border-zinc-200/50 bg-zinc-50/40 hover:border-zinc-300 hover:bg-white'
    }`}>
      <div className="min-w-0 flex-1 flex items-center gap-3.5">
        <input 
          type="checkbox" 
          checked={isSelecionado} 
          onChange={onToggleSelect} 
          className="w-4 h-4 rounded-md border-zinc-300 text-[#E16349] cursor-pointer accent-[#E16349]" 
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight text-[#1A1A1A] sm:text-base">
            {insumo.nome}
          </h3>
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Unidade: {insumo.unidade_medida}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 text-zinc-500 sm:justify-end sm:gap-8">
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-4 sm:gap-10">
          <div className="text-left sm:text-right min-w-[70px]">
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Custo Unit.</span>
            <span className="text-xs font-semibold text-zinc-700 sm:text-sm">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 4 }).format(insumo.custo_unitario)}
            </span>
          </div>

          <div className="text-left sm:text-right min-w-[65px]">
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Estoque</span>
            <span className={`text-xs font-semibold sm:text-sm ${estoqueCritico ? 'font-bold text-red-500' : 'text-zinc-700'}`}>
              {insumo.estoque_atual}{insumo.unidade_medida}
            </span>
          </div>

          <div className="text-left sm:text-right min-w-[65px]">
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Mínimo</span>
            <span className="text-xs font-medium text-zinc-400 sm:text-sm">
              {insumo.estoque_minimo}{insumo.unidade_medida}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onEditarClick(insumo)}
          disabled={isPending}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-800"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => onExcluirClick(insumo)}
          disabled={isPending}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-60"
          aria-label={`Apagar ${insumo.nome}`}
          title="Apagar insumo"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2m-7 4v8m6-8v8M5 6l1 14h12l1-14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
