import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { atualizarStatusPedidoComNotificacoes } from '@/utils/pedidos-acompanhamento';
import type { StatusPedido } from '@/utils/pedido-status';

const STATUS_VALIDOS: StatusPedido[] = ['PENDENTE', 'PAGO', 'PREPARANDO', 'PRONTO', 'SAIU_PARA_ENTREGA', 'ENTREGUE'];

interface Params {
  params: Promise<{ pedidoId: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { pedidoId } = await params;
    const body = (await request.json()) as { status?: StatusPedido };
    const novoStatus = body.status;

    if (!novoStatus || !STATUS_VALIDOS.includes(novoStatus)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('perfis_admin')
      .select('restaurante_id')
      .eq('id', user.id)
      .maybeSingle();

    if (perfilError || !perfil?.restaurante_id) {
      return NextResponse.json({ error: 'Restaurante do gestor não localizado.' }, { status: 403 });
    }

    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, restaurante_id')
      .eq('id', pedidoId)
      .maybeSingle();

    if (pedidoError || !pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }

    if (pedido.restaurante_id !== perfil.restaurante_id) {
      return NextResponse.json({ error: 'Acesso negado a este pedido.' }, { status: 403 });
    }

    const resultado = await atualizarStatusPedidoComNotificacoes({
      pedidoId,
      novoStatus,
    });

    return NextResponse.json({ success: true, pedido: resultado.pedido, mudouStatus: resultado.mudouStatus });
  } catch (error) {
    console.error('Erro ao atualizar status do pedido no painel admin:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar pedido.' }, { status: 500 });
  }
}
