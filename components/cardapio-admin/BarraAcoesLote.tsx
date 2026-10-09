'use client';

import { estilosPainel } from '@/components/shared/estilosPainel';

interface BarraAcoesProps {
  todosSelecionados: boolean;
  onSelecionarTodos: () => void;
  qtdSelecionados: number;
  onAlterarStatus: (disponivel: boolean) => void;
  onExcluirSelecionados: () => void;
  isPending: boolean;
}

/**
 * Linha compacta com "Selecionar todos". As ações em lote só aparecem depois que algum item é marcado:
 * no celular ficam numa barra flutuante acima da navegação, no desktop numa linha ao lado.
 */
export default function BarraAcoesLote({
  todosSelecionados,
  onSelecionarTodos,
  qtdSelecionados,
  onAlterarStatus,
  onExcluirSelecionados,
  isPending,
}: BarraAcoesProps) {
  const temSelecao = qtdSelecionados > 0;

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-[#F8F8F8]/70 px-4 py-2 sm:px-6">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:min-h-9">
          <input
            type="checkbox"
            checked={todosSelecionados}
            onChange={onSelecionarTodos}
            className="h-5 w-5 cursor-pointer rounded-md border-zinc-300 accent-[#E16349] sm:h-4 sm:w-4"
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
            {temSelecao ? `${qtdSelecionados} ${qtdSelecionados === 1 ? 'selecionado' : 'selecionados'}` : 'Selecionar todos'}
          </span>
        </label>

        {temSelecao && (
          <div className="hidden items-center gap-2 md:flex">
            <button type="button" onClick={() => onAlterarStatus(true)} disabled={isPending} className={estilosPainel.botaoEscuro}>
              Ativar
            </button>
            <button type="button" onClick={() => onAlterarStatus(false)} disabled={isPending} className={estilosPainel.botaoSecundario}>
              Pausar
            </button>
            <button type="button" onClick={onExcluirSelecionados} disabled={isPending} className={estilosPainel.botaoPerigo}>
              Apagar
            </button>
          </div>
        )}
      </div>

      {temSelecao && (
        <div
          role="toolbar"
          aria-label={`Ações para ${qtdSelecionados} produtos selecionados`}
          className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-20 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl md:hidden"
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {qtdSelecionados} {qtdSelecionados === 1 ? 'selecionado' : 'selecionados'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => onAlterarStatus(true)} disabled={isPending} className={estilosPainel.botaoEscuro}>
              Ativar
            </button>
            <button type="button" onClick={() => onAlterarStatus(false)} disabled={isPending} className={estilosPainel.botaoSecundario}>
              Pausar
            </button>
            <button type="button" onClick={onExcluirSelecionados} disabled={isPending} className={estilosPainel.botaoPerigo}>
              Apagar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
