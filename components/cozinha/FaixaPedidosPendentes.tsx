'use client';

import { useState } from 'react';
import type { PedidoCozinha } from '@/app/(dashboard)/admin/cozinha/useCozinha';
import { formatarDuracao, formatarHoraPedido, formatarMoedaCozinha, minutosDesde, rotuloFormaPagamento, rotuloNumeroPedido } from '@/utils/cozinha';

const MINUTOS_PARA_ALERTA = 30;

interface FaixaPedidosPendentesProps {
  pedidos: PedidoCozinha[];
  agora: number;
  cancelandoIds: string[];
  onCancelar: (pedido: PedidoCozinha) => void;
}

export function FaixaPedidosPendentes({ pedidos, agora, cancelandoIds, onCancelar }: FaixaPedidosPendentesProps) {
  const [aberta, setAberta] = useState(false);

  if (pedidos.length === 0) return null;

  const titulo = pedidos.length === 1 ? '1 pedido aguardando pagamento' : `${pedidos.length} pedidos aguardando pagamento`;

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
      <button
        type="button"
        onClick={() => setAberta((atual) => !atual)}
        aria-expanded={aberta}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-amber-900">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {titulo}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
          {aberta ? 'Ocultar' : 'Ver'}
          <svg className={`h-3 w-3 transition-transform ${aberta ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {aberta && (
        <ul className="border-t border-amber-200 bg-white">
          {pedidos.map((pedido) => {
            const minutos = minutosDesde(pedido.created_at, agora);
            const semPagamento = minutos >= MINUTOS_PARA_ALERTA;
            const forma = rotuloFormaPagamento(pedido.forma_pagamento);
            const cancelando = cancelandoIds.includes(pedido.id);
            return (
              <li key={pedido.id} className="flex flex-wrap items-center gap-3 border-b border-amber-100 px-4 py-2.5 last:border-b-0">
                <div className="min-w-44 flex-1">
                  <p className="text-[13px] font-bold text-[#1A1A1A]">
                    {rotuloNumeroPedido(pedido)} · {pedido.dados_cliente?.nome}
                  </p>
                  <p className={`text-[11px] ${semPagamento ? 'text-red-700' : 'text-zinc-500'}`}>
                    {semPagamento
                      ? `${forma} não pago · pedido de ${formatarHoraPedido(pedido.created_at, agora)} (${formatarDuracao(minutos)})`
                      : `Aguardando ${forma} há ${formatarDuracao(minutos)}`}
                  </p>
                </div>
                <span className="text-[13px] font-bold text-[#1A1A1A]">{formatarMoedaCozinha(pedido.valor_total)}</span>
                <button
                  type="button"
                  onClick={() => onCancelar(pedido)}
                  disabled={cancelando}
                  className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-[11px] font-semibold text-zinc-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                >
                  {cancelando ? 'Aguarde...' : 'Recusar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
