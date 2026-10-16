import { NextResponse } from 'next/server';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { listarPedidosIfood } from '@/utils/ifood-pedidos';

export async function GET() {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    return NextResponse.json({ pedidos: await listarPedidosIfood(restauranteId) });
  } catch (error) {
    console.error('Erro ao listar pedidos do iFood:', error);
    const mensagem = error instanceof Error ? error.message : 'Erro ao listar pedidos do iFood.';
    return NextResponse.json({ pedidos: [], error: mensagem }, { status: 200 });
  }
}
