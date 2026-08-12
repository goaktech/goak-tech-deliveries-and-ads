import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
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
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 });
    }

    const { data: restaurante, error: restauranteError } = await supabase
      .from('restaurantes')
      .select('id, nome, slug, logo_url, endereco')
      .eq('id', perfil.restaurante_id)
      .maybeSingle();

    if (restauranteError || !restaurante) {
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 });
    }

    return NextResponse.json(restaurante);
  } catch (error) {
    console.error('Erro ao carregar restaurante do gestor:', error);
    return NextResponse.json({ error: 'Erro interno ao carregar restaurante.' }, { status: 500 });
  }
}
