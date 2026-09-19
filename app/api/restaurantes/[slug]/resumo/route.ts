import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { normalizarFormasPagamento } from '@/utils/formas-pagamento';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    // colunas públicas de `restaurantes` (o papel anon/authenticated só enxerga as que têm GRANT)
    const { data: restaurante, error } = await supabase
      .from('restaurantes')
      .select('nome, slug, endereco, latitude, longitude')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !restaurante) {
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 });
    }

    // `formas_pagamento_aceitas` não tem GRANT de leitura para anon/authenticated: é lida no
    // servidor com o cliente administrativo, e só esse campo (a lista de formas aceitas) sai daqui.
    // Se essa leitura falhar, o checkout cai no padrão (só PIX) sem perder o resto do resumo.
    const { data: configPagamento, error: erroPagamento } = await createWebhookAdminClient()
      .from('restaurantes')
      .select('formas_pagamento_aceitas')
      .eq('slug', slug)
      .maybeSingle();

    if (erroPagamento) {
      console.error('Erro ao ler formas de pagamento do restaurante:', erroPagamento);
    }

    return NextResponse.json({
      ...restaurante,
      formas_pagamento_aceitas: normalizarFormasPagamento(configPagamento?.formas_pagamento_aceitas),
    });
  } catch (error) {
    console.error('Erro ao obter resumo do restaurante:', error);
    return NextResponse.json({ error: 'Erro interno ao carregar restaurante.' }, { status: 500 });
  }
}
