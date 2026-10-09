import { NextResponse } from 'next/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { obterTokenMercadoPagoValido } from '@/utils/mercado-pago';
import { buscarPagamentosPorExternalReference } from '@/utils/pagamentos-mercado-pago';

// Devolve o PIX ainda válido de um pedido PENDENTE (para a tela continuar de onde parou depois de
// um reload ou ao reabrir o acompanhamento). Não cria cobrança. Quem tem o código do pedido já pode
// ver o pedido na tela de acompanhamento; o QR só vale para pagar ESTE pedido.

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = (url.searchParams.get('slug') ?? '').trim();
    const codigo = (url.searchParams.get('codigo') ?? '').trim();
    if (!slug || !codigo) {
      return NextResponse.json({ error: 'Dados da requisição inválidos.' }, { status: 400 });
    }

    const supabase = createWebhookAdminClient();
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id, status, valor_total, mercado_pago_external_reference, restaurantes ( id, slug )')
      .eq('codigo_acompanhamento', codigo)
      .maybeSingle();

    const restaurante = Array.isArray(pedido?.restaurantes) ? pedido?.restaurantes[0] : pedido?.restaurantes;
    if (!pedido || !restaurante || restaurante.slug !== slug) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }
    if (pedido.status !== 'PENDENTE' || !pedido.mercado_pago_external_reference) {
      return NextResponse.json({ pix: null, status: pedido.status, valor_total: Number(pedido.valor_total) });
    }

    const token = await obterTokenMercadoPagoValido(restaurante.id);
    const pagamentos = await buscarPagamentosPorExternalReference(token, pedido.mercado_pago_external_reference);
    const agora = Date.now();
    const pendente = pagamentos.find(
      (pagamento) =>
        pagamento.status === 'pending' &&
        pagamento.payment_method_id === 'pix' &&
        pagamento.point_of_interaction?.transaction_data?.qr_code &&
        (!pagamento.date_of_expiration || new Date(pagamento.date_of_expiration).getTime() > agora)
    );
    if (!pendente) {
      return NextResponse.json({ pix: null, status: pedido.status, valor_total: Number(pedido.valor_total) });
    }

    const dados = pendente.point_of_interaction?.transaction_data;
    return NextResponse.json(
      {
        status: pedido.status,
        valor_total: Number(pedido.valor_total),
        pix: {
          payment_id: String(pendente.id),
          qr_code: dados?.qr_code ?? '',
          qr_code_base64: dados?.qr_code_base64 ?? '',
          expira_em: pendente.date_of_expiration ? new Date(pendente.date_of_expiration).toISOString() : null,
        },
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (error) {
    console.error('Erro ao buscar PIX pendente:', error);
    return NextResponse.json({ pix: null, error: 'Não foi possível consultar o PIX agora.' }, { status: 200 });
  }
}
