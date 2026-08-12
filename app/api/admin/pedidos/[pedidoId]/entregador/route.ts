import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { atribuirEntregadorManualmente } from '@/utils/entregadores';

interface Params {
  params: Promise<{ pedidoId: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { pedidoId } = await params;
    const body = (await request.json()) as { entregadorId?: string | null };
    const entregadorId = body.entregadorId ? String(body.entregadorId) : null;

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

    const resultado = await atribuirEntregadorManualmente({
      pedidoId,
      entregadorId,
      restauranteId: perfil.restaurante_id,
    });

    if (!resultado.success) {
      return NextResponse.json({ error: resultado.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao atribuir entregador ao pedido:', error);
    return NextResponse.json({ error: 'Erro interno ao atribuir entregador.' }, { status: 500 });
  }
}
