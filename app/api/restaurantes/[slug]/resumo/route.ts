import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { aceitaCartao, normalizarFormasPagamento } from '@/utils/formas-pagamento';
import { obterChavePublicaMercadoPago } from '@/utils/mercado-pago';
import { lojaEntregaPeloIfood } from '@/utils/ifood-entrega';

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

    const { data: configPagamento, error: erroPagamento } = await createWebhookAdminClient()
      .from('restaurantes')
      .select('id, formas_pagamento_aceitas')
      .eq('slug', slug)
      .maybeSingle();

    if (erroPagamento) {
      console.error('Erro ao ler formas de pagamento do restaurante:', erroPagamento);
    }

    const formasAceitas = normalizarFormasPagamento(configPagamento?.formas_pagamento_aceitas);

    let mpPublicKey: string | null = null;
    if (configPagamento?.id && aceitaCartao(formasAceitas)) {
      try {
        mpPublicKey = await obterChavePublicaMercadoPago(configPagamento.id);
      } catch (erroChave) {
        console.error('Erro ao obter chave pública do Mercado Pago:', erroChave);
      }
    }

    const entregaIfood = configPagamento?.id ? await lojaEntregaPeloIfood(configPagamento.id) : false;

    return NextResponse.json({
      ...restaurante,
      formas_pagamento_aceitas: formasAceitas,
      mp_public_key: mpPublicKey,
      entrega_ifood: entregaIfood,
    });
  } catch (error) {
    console.error('Erro ao obter resumo do restaurante:', error);
    return NextResponse.json({ error: 'Erro interno ao carregar restaurante.' }, { status: 500 });
  }
}
