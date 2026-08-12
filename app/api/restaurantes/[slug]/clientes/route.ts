import { NextResponse } from 'next/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

interface Params {
  params: Promise<{ slug: string }>;
}

const TELEFONE_MINIMO_DIGITOS = 10;

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const telefoneNormalizado = (searchParams.get('telefone') ?? '').replace(/\D/g, '');

    if (telefoneNormalizado.length < TELEFONE_MINIMO_DIGITOS) {
      return NextResponse.json({ encontrado: false });
    }

    const supabase = createWebhookAdminClient();

    const { data: restaurante } = await supabase
      .from('restaurantes')
      .select('id')
      .eq('slug', slug.trim())
      .maybeSingle();

    if (!restaurante) {
      return NextResponse.json({ encontrado: false });
    }

    const { data: cliente } = await supabase
      .from('public_clientes')
      .select('nome, email, endereco')
      .eq('restaurante_id', restaurante.id)
      .eq('telefone', telefoneNormalizado)
      .maybeSingle();

    if (!cliente) {
      return NextResponse.json({ encontrado: false });
    }

    return NextResponse.json({
      encontrado: true,
      nome: cliente.nome,
      email: cliente.email,
      endereco: cliente.endereco,
    });
  } catch (error) {
    console.error('Erro ao buscar cadastro de cliente:', error);
    return NextResponse.json({ encontrado: false });
  }
}
