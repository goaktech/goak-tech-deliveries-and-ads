import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    const { data: restaurante, error } = await supabase
      .from('restaurantes')
      .select('nome, slug, endereco, latitude, longitude')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !restaurante) {
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 });
    }

    return NextResponse.json(restaurante);
  } catch (error) {
    console.error('Erro ao obter resumo do restaurante:', error);
    return NextResponse.json({ error: 'Erro interno ao carregar restaurante.' }, { status: 500 });
  }
}
