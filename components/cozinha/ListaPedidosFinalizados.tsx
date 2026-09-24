'use client';

import type { PedidoCozinha } from '@/app/(dashboard)/admin/cozinha/useCozinha';
import { type ConfigImpressaoComanda, formatarHoraPedido, formatarMoedaCozinha, imprimirComanda, rotuloNumeroPedido } from '@/utils/cozinha';
import { obterTipoEntregaPedido } from '@/utils/pedido-status';

interface ListaPedidosFinalizadosProps {
  pedidos: PedidoCozinha[];
  agora: number;
  impressao: ConfigImpressaoComanda;
}

export function ListaPedidosFinalizados({ pedidos, agora, impressao }: ListaPedidosFinalizadosProps) {
  const ordenados = [...pedidos].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return (
    <ul className="flex flex-col">
      {ordenados.map((pedido) => {
        const cancelado = pedido.status === 'CANCELADO';
        const retirada = obterTipoEntregaPedido(pedido.dados_cliente) === 'RETIRADA';
        const hora = formatarHoraPedido(pedido.updated_at, agora);
        const detalhe = cancelado
          ? ['Cancelado', pedido.motivo_cancelamento].filter(Boolean).join(' · ')
          : `${retirada ? 'Retirado' : 'Entregue'} às ${hora}`;

        return (
          <li key={pedido.id} className="flex items-center gap-3 border-b border-zinc-100 px-1 py-3 last:border-b-0">
            <span className={`h-2 w-2 shrink-0 rounded-full ${cancelado ? 'bg-red-500' : 'bg-emerald-500'}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-[#1A1A1A]">
                {rotuloNumeroPedido(pedido)} · {pedido.dados_cliente?.nome}
              </p>
              <p className="text-[11px] text-zinc-500">{detalhe}</p>
            </div>
            <span className={`text-[13px] font-bold ${cancelado ? 'text-zinc-400 line-through' : 'text-[#1A1A1A]'}`}>
              {formatarMoedaCozinha(pedido.valor_total)}
            </span>
            {!cancelado && (
              <button
                type="button"
                onClick={() => void imprimirComanda(pedido, impressao)}
                aria-label={`Imprimir comanda do pedido ${rotuloNumeroPedido(pedido)}`}
                title="Imprimir comanda"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-[#1A1A1A]"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9V3h12v6" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="7" />
                </svg>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
