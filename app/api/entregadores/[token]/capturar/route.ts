import { NextResponse } from 'next/server';
import { buscarEntregadorPorToken, capturarPedido } from '@/utils/entregadores';

interface Params {
  params: Promise<{ token: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const entregador = await buscarEntregadorPorToken(token);

    if (!entregador || !entregador.ativo) {
      return NextResponse.json({ error: 'Acesso inválido.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const pedidoId = String(body?.pedidoId ?? '').trim();

    if (!pedidoId) {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    }

    const resultado = await capturarPedido(pedidoId, entregador.id);

    if (!resultado.success) {
      return NextResponse.json({ error: resultado.error }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao capturar pedido:', error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
