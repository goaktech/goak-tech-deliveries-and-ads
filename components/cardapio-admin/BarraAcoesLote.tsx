'use client';

interface BarraAcoesProps {
  todosSelecionados: boolean;
  onSelecionarTodos: () => void;
  qtdSelecionados: number;
  onAlterarStatus: (disponivel: boolean) => void;
  onExcluirSelecionados: () => void;
  isPending: boolean;
}

export default function BarraAcoesLote({
  todosSelecionados,
  onSelecionarTodos,
  qtdSelecionados,
  onAlterarStatus,
  onExcluirSelecionados,
  isPending,
}: BarraAcoesProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-zinc-100 bg-[#F8F8F8]/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-center gap-3">
        <input 
          type="checkbox" 
          checked={todosSelecionados}
          onChange={onSelecionarTodos}
          className="w-4 h-4 rounded-md border-zinc-300 text-[#E16349] focus:ring-[#E16349] cursor-pointer accent-[#E16349]"
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
          {qtdSelecionados > 0 ? `${qtdSelecionados} selecionados` : 'Selecionar Todos'}
        </span>
      </div>

      <div className={`flex flex-wrap items-center gap-2 transition-all ${qtdSelecionados > 0 ? 'opacity-100' : 'pointer-events-none opacity-40'}`}>
        <button onClick={() => onAlterarStatus(true)} disabled={isPending} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800">
          Ativar Selecionados
        </button>
        <button onClick={() => onAlterarStatus(false)} disabled={isPending} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-600 hover:border-zinc-400 hover:text-zinc-800">
          Pausar Selecionados
        </button>
        <button
          onClick={onExcluirSelecionados}
          disabled={isPending}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:border-red-300 hover:bg-red-100"
        >
          Apagar Selecionados
        </button>
      </div>
    </div>
  );
}
