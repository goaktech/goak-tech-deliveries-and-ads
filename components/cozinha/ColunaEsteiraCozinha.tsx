'use client';

import React from 'react';
import { EntregadorCozinha, PedidoCozinha } from '@/app/(dashboard)/admin/cozinha/useCozinha';
import { CardPedidoCozinha } from './CardPedidoCozinha';

interface ColunaEsteiraCozinhaProps {
  titulo: string;
  pedidos: PedidoCozinha[];
  onAvancarStatus: (pedidoId: string, novoStatus: PedidoCozinha['status']) => void;
  isMutating: boolean;
  entregadores: EntregadorCozinha[];
  onAtribuirEntregador: (pedidoId: string, entregadorId: string | null) => void;
  exibirCabecalho?: boolean;
}

export function ColunaEsteiraCozinha({
  titulo,
  pedidos,
  onAvancarStatus,
  isMutating,
  entregadores,
  onAtribuirEntregador,
  exibirCabecalho = true,
}: ColunaEsteiraCozinhaProps) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      {exibirCabecalho && (
        <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5 px-1 select-none">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]">{titulo}</span>
          <span className="rounded-[8px] border border-zinc-200/60 bg-[#F3F3F3] px-2 py-0.5 text-xs font-mono font-semibold text-zinc-600">
            {pedidos.length}
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[65vh] min-h-[120px] p-0.5 sm:grid-cols-2 lg:grid-cols-3">
        {pedidos.length === 0 ? (
          <div className="col-span-full flex flex-1 flex-col items-center justify-center py-10 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Esteira limpa</span>
          </div>
        ) : (
          pedidos.map((pedido) => (
            <CardPedidoCozinha
              key={pedido.id}
              pedido={pedido}
              onAvancarStatus={onAvancarStatus}
              isMutating={isMutating}
              entregadores={entregadores}
              onAtribuirEntregador={onAtribuirEntregador}
            />
          ))
        )}
      </div>
    </div>
  );
}
