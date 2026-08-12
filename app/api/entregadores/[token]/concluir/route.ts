import { NextResponse } from 'next/server';
import { buscarEntregadorPorToken, marcarEntregaConcluidaPeloEntregador } from '@/utils/entregadores';

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
    const codigoConfirmacao = String(body?.codigoConfirmacao ?? '').trim();

    if (!pedidoId) {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    }

    if (!codigoConfirmacao) {
      return NextResponse.json({ error: 'Informe o código de confirmação do cliente.' }, { status: 400 });
    }

    const resultado = await marcarEntregaConcluidaPeloEntregador(pedidoId, entregador.id, codigoConfirmacao);

    if (!resultado.success) {
      return NextResponse.json({ error: resultado.error }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao concluir entrega:', error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
