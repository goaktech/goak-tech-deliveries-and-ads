import { NextResponse } from 'next/server';
import {
  buscarEntregadorPorToken,
  listarPedidosAtivosDoEntregador,
  listarPedidosDisponiveisParaCaptura,
} from '@/utils/entregadores';

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const entregador = await buscarEntregadorPorToken(token);

    if (!entregador) {
      return NextResponse.json({ error: 'Link inválido.' }, { status: 404 });
    }

    if (!entregador.ativo) {
      return NextResponse.json({ error: 'Este acesso foi desativado. Fale com a loja.' }, { status: 403 });
    }

    const [disponiveis, ativos] = await Promise.all([
      listarPedidosDisponiveisParaCaptura(entregador.restauranteId),
      listarPedidosAtivosDoEntregador(entregador.id),
    ]);

    return NextResponse.json({
      entregador: { nome: entregador.nome },
      disponiveis,
      ativos,
    });
  } catch (error) {
    console.error('Erro ao carregar pedidos do entregador:', error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
