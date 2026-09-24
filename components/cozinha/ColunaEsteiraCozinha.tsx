'use client';

import type { EntregadorCozinha, PedidoCozinha } from '@/app/(dashboard)/admin/cozinha/useCozinha';
import type { ConfigImpressaoComanda } from '@/utils/cozinha';
import { CardPedidoCozinha } from './CardPedidoCozinha';

interface ColunaEsteiraCozinhaProps {
  pedidos: PedidoCozinha[];
  agora: number;
  impressao: ConfigImpressaoComanda;
  entregadores: EntregadorCozinha[];
  cancelandoIds: string[];
  onAvancar: (pedido: PedidoCozinha) => void;
  onCancelar: (pedido: PedidoCozinha) => void;
  onAtribuirEntregador: (pedidoId: string, entregadorId: string | null) => void;
}

export function ColunaEsteiraCozinha({
  pedidos,
  agora,
  impressao,
  entregadores,
  cancelandoIds,
  onAvancar,
  onCancelar,
  onAtribuirEntregador,
}: ColunaEsteiraCozinhaProps) {
  if (pedidos.length === 0) return null;

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pedidos.map((pedido) => (
        <CardPedidoCozinha
          key={pedido.id}
          pedido={pedido}
          agora={agora}
          impressao={impressao}
          entregadores={entregadores}
          cancelando={cancelandoIds.includes(pedido.id)}
          onAvancar={onAvancar}
          onCancelar={onCancelar}
          onAtribuirEntregador={onAtribuirEntregador}
        />
      ))}
    </div>
  );
}
