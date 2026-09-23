import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ErroCancelamentoPedido, cancelarPedido } from '@/utils/pedidos-acompanhamento';

interface Params {
  params: Promise<{ pedidoId: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { pedidoId } = await params;
    const body = (await request.json().catch(() => ({}))) as { motivo?: unknown };
    const motivo = typeof body.motivo === 'string' ? body.motivo : '';

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

    const resultado = await cancelarPedido({
      pedidoId,
      restauranteId: perfil.restaurante_id as string,
      motivo,
    });

    return NextResponse.json({
      success: true,
      pedido: resultado.pedido,
      foiPago: resultado.foiPago,
    });
  } catch (error) {
    if (error instanceof ErroCancelamentoPedido) {
      return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    }
    console.error('Erro ao cancelar pedido no painel admin:', error);
    return NextResponse.json({ error: 'Erro interno ao cancelar pedido.' }, { status: 500 });
  }
}
