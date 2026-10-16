import { NextResponse } from 'next/server';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import {
  cancelarPedidoIfood,
  executarAcaoPedidoIfood,
  listarMotivosCancelamentoPedidoIfood,
} from '@/utils/ifood-pedidos';

interface Params {
  params: Promise<{ orderId: string }>;
}

type Corpo =
  | { acao: 'confirmar' | 'pronto' | 'despachar' | 'motivos' }
  | { acao: 'cancelar'; codigo: string; descricao: string };

// Ações da cozinha num pedido recebido do iFood — ver utils/ifood-pedidos.ts.
export async function POST(request: Request, { params }: Params) {
  try {
    const { orderId } = await params;
    const corpo = (await request.json().catch(() => ({}))) as Corpo;
    const restauranteId = await obterRestauranteIdDoGestorLogado();

    switch (corpo.acao) {
      case 'confirmar':
      case 'pronto':
      case 'despachar':
        await executarAcaoPedidoIfood(restauranteId, orderId, corpo.acao);
        return NextResponse.json({ success: true });
      case 'motivos':
        return NextResponse.json({ motivos: await listarMotivosCancelamentoPedidoIfood(restauranteId, orderId) });
      case 'cancelar':
        if (!corpo.codigo) {
          return NextResponse.json({ error: 'Escolha o motivo do cancelamento.' }, { status: 400 });
        }
        await cancelarPedidoIfood(restauranteId, orderId, corpo.codigo, corpo.descricao ?? '');
        return NextResponse.json({ success: true });
      default:
        return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
    }
  } catch (error) {
    console.error('Erro na ação do pedido do iFood:', error);
    const mensagem = error instanceof Error ? error.message : 'Erro ao executar a ação no iFood.';
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
}
