import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { aceitaCartao, normalizarFormasPagamento } from '@/utils/formas-pagamento';
import { obterChavePublicaMercadoPago } from '@/utils/mercado-pago';

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
      .select('id, formas_pagamento_aceitas')
      .eq('slug', slug)
      .maybeSingle();

    if (erroPagamento) {
      console.error('Erro ao ler formas de pagamento do restaurante:', erroPagamento);
    }

    const formasAceitas = normalizarFormasPagamento(configPagamento?.formas_pagamento_aceitas);

    // Chave PÚBLICA do Mercado Pago da loja: é feita para ir ao navegador (tokeniza o cartão no
    // formulário embutido). Sem ela, o checkout usa o Checkout Pro do Mercado Pago como antes.
    let mpPublicKey: string | null = null;
    if (configPagamento?.id && aceitaCartao(formasAceitas)) {
      try {
        mpPublicKey = await obterChavePublicaMercadoPago(configPagamento.id);
      } catch (erroChave) {
        console.error('Erro ao obter chave pública do Mercado Pago:', erroChave);
      }
    }

    return NextResponse.json({
      ...restaurante,
      formas_pagamento_aceitas: formasAceitas,
      mp_public_key: mpPublicKey,
    });
  } catch (error) {
    console.error('Erro ao obter resumo do restaurante:', error);
    return NextResponse.json({ error: 'Erro interno ao carregar restaurante.' }, { status: 500 });
  }
}
