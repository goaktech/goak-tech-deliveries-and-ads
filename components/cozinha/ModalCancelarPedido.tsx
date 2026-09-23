'use client';

import { useEffect, useRef, useState } from 'react';
import type { PedidoCozinha } from '@/app/(dashboard)/admin/cozinha/useCozinha';
import { formatarMoedaCozinha, rotuloNumeroPedido } from '@/utils/cozinha';

const MOTIVOS = [
  'Cliente desistiu',
  'Item indisponível',
  'Cozinha sem capacidade',
  'Fora da área de entrega',
  'Pagamento não confirmado',
  'Outro',
];

interface ModalCancelarPedidoProps {
  pedido: PedidoCozinha | null;
  cancelando: boolean;
  onFechar: () => void;
  onConfirmar: (pedido: PedidoCozinha, motivo: string) => Promise<boolean>;
}

export function ModalCancelarPedido({ pedido, cancelando, onFechar, onConfirmar }: ModalCancelarPedidoProps) {
  if (!pedido) return null;
  return <ConteudoModal key={pedido.id} pedido={pedido} cancelando={cancelando} onFechar={onFechar} onConfirmar={onConfirmar} />;
}

function ConteudoModal({
  pedido,
  cancelando,
  onFechar,
  onConfirmar,
}: {
  pedido: PedidoCozinha;
  cancelando: boolean;
  onFechar: () => void;
  onConfirmar: (pedido: PedidoCozinha, motivo: string) => Promise<boolean>;
}) {
  const foiPago = pedido.status !== 'PENDENTE';
  const ehRecusa = pedido.status === 'PAGO' || pedido.status === 'PENDENTE';
  const acao = ehRecusa ? 'Recusar' : 'Cancelar';
  const [motivo, setMotivo] = useState(foiPago ? MOTIVOS[0] : 'Pagamento não confirmado');
  const [outroMotivo, setOutroMotivo] = useState('');
  const botaoVoltarRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    botaoVoltarRef.current?.focus();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && !cancelando) onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [cancelando, onFechar]);

  const motivoFinal = motivo === 'Outro' ? outroMotivo.trim() : motivo;
  const podeConfirmar = motivoFinal.length > 0 && !cancelando;

  const confirmar = async () => {
    if (!podeConfirmar) return;
    const sucesso = await onConfirmar(pedido, motivoFinal);
    if (sucesso) onFechar();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 sm:items-center sm:p-6"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget && !cancelando) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-cancelar-pedido"
        className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-white p-5 pb-8 shadow-xl sm:rounded-3xl sm:pb-5"
      >
        <div>
          <h2 id="titulo-cancelar-pedido" className="text-base font-bold text-[#1A1A1A]">
            {acao} pedido {rotuloNumeroPedido(pedido)}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {pedido.dados_cliente?.nome} · {formatarMoedaCozinha(pedido.valor_total)}
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Motivo</legend>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS.map((opcao) => {
              const ativo = motivo === opcao;
              return (
                <button
                  key={opcao}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setMotivo(opcao)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    ativo ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  {opcao}
                </button>
              );
            })}
          </div>
          {motivo === 'Outro' && (
            <input
              type="text"
              value={outroMotivo}
              onChange={(e) => setOutroMotivo(e.target.value)}
              maxLength={200}
              autoFocus
              aria-label="Descreva o motivo"
              placeholder="Descreva o motivo"
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none"
            />
          )}
        </fieldset>

        {foiPago && (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-600">
            O pedido já foi pago. Depois de {ehRecusa ? 'recusar' : 'cancelar'}, faça a devolução de{' '}
            <span className="font-bold text-[#1A1A1A]">{formatarMoedaCozinha(pedido.valor_total)}</span> ao cliente pelo Mercado Pago.
          </p>
        )}

        <div className="flex gap-2">
          <button
            ref={botaoVoltarRef}
            type="button"
            onClick={onFechar}
            disabled={cancelando}
            className="h-11 flex-1 rounded-xl border border-zinc-200 bg-white text-xs font-semibold uppercase tracking-wide text-zinc-700 transition hover:border-zinc-300 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!podeConfirmar}
            className="h-11 flex-1 rounded-xl bg-[#1A1A1A] text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-black disabled:opacity-50"
          >
            {cancelando ? 'Aguarde...' : `${acao} pedido`}
          </button>
        </div>
      </div>
    </div>
  );
}
