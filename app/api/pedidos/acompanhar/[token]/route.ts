import { NextResponse } from 'next/server';
import { buscarPedidoPublicoPorToken, obterResumoPedidoPublico } from '@/utils/pedidos-acompanhamento';

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const slug = request.headers.get('x-restaurante-slug') || new URL(request.url).searchParams.get('slug') || '';

    if (!slug.trim() || !token.trim()) {
      return NextResponse.json({ error: 'Slug ou token ausente.' }, { status: 400 });
    }

    const pedido = await buscarPedidoPublicoPorToken(slug.trim(), token.trim());
    if (!pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }

    return NextResponse.json(obterResumoPedidoPublico(pedido));
  } catch (error) {
    console.error('Erro ao carregar acompanhamento público do pedido:', error);
    return NextResponse.json({ error: 'Erro interno ao carregar pedido.' }, { status: 500 });
  }
}
