import { NextResponse } from 'next/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { estaLojaAberta, type HorarioFuncionamentoDia } from '@/utils/horario-funcionamento';
import { avaliarItensCarrinho, type ItemParaAvaliar } from '@/utils/politica-preco';

// Confere a sacola do cliente com o cardápio de agora (preço visto x preço atual, item e adicionais
// disponíveis, loja aberta) SEM criar pedido. Usa exatamente a mesma regra do POST /api/checkout.

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { slug?: string; itens?: ItemParaAvaliar[] };
    const slug = String(body.slug ?? '').trim();
    const itens = Array.isArray(body.itens) ? body.itens.slice(0, 60) : [];
    if (!slug) {
      return NextResponse.json({ error: 'Dados da requisição inválidos.' }, { status: 400 });
    }
    if (itens.length === 0) {
      return NextResponse.json({ aberta: true, itens: [] });
    }
    const valido = itens.every(
      (item) =>
        typeof item?.item_cardapio_id === 'string' &&
        item.item_cardapio_id.length > 0 &&
        (item.precoVisto === undefined || typeof item.precoVisto === 'number')
    );
    if (!valido) {
      return NextResponse.json({ error: 'Itens inválidos.' }, { status: 400 });
    }

    const supabase = createWebhookAdminClient();
    const { data: restaurante } = await supabase
      .from('restaurantes')
      .select('id, horarios_funcionamento')
      .eq('slug', slug)
      .maybeSingle();
    if (!restaurante) {
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 });
    }

    const horarios = restaurante.horarios_funcionamento as HorarioFuncionamentoDia[] | null;
    const avaliacoes = await avaliarItensCarrinho({ supabase, restauranteId: restaurante.id, horarios, itens });
    return NextResponse.json({ aberta: estaLojaAberta(horarios), itens: avaliacoes });
  } catch (error) {
    console.error('Erro ao validar a sacola:', error);
    return NextResponse.json({ error: 'Não foi possível conferir a sacola agora.' }, { status: 500 });
  }
}
