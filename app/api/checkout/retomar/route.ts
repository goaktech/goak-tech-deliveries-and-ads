import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { obterTiposMeioPagamentoMercadoPago, obterTokenMercadoPagoValido } from '@/utils/mercado-pago';
import {
  cobrarPedidoMercadoPago,
  lerDadosCartaoEmbutido,
  type ItemPrecificado,
} from '@/utils/cobranca-pedido-mercado-pago';
import {
  aceitaCartao,
  aceitaCartaoCredito,
  aceitaCartaoDebito,
  aceitaPix,
  normalizarFormasPagamento,
} from '@/utils/formas-pagamento';
import type { DadosClientePedido } from '@/utils/pedido-status';

// Nova tentativa de pagamento de um pedido que ainda está PENDENTE (cartão recusado, PIX expirado,
// cliente que fechou a tela...). Reaproveita o MESMO pedido: valor, itens e cliente vêm do banco,
// nunca do navegador. Só o meio de pagamento (e o token do cartão) é enviado agora.

const PRAZO_NOVA_TENTATIVA_MS = 12 * 60 * 60 * 1000;

interface RequestBody {
  slug?: string;
  codigoAcompanhamento?: string;
  paymentMethod?: 'PIX' | 'CARTAO';
  cartao?: unknown;
}

interface LinhaItemPedido {
  item_cardapio_id: string;
  quantidade: number;
  preco_unitario: number;
  itens_cardapio: { nome: string } | { nome: string }[] | null;
  itens_pedido_complementos: Array<{ id: string; nome: string; preco_adicional: number }> | null;
}

interface RestauranteRelacionado {
  id: string;
  nome: string;
  slug: string;
  formas_pagamento_aceitas: unknown;
}

function primeiro<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

export async function POST(request: Request) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: 'URL pública da aplicação não configurada.' }, { status: 500 });
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const slug = String(body.slug ?? '').trim();
    const codigo = String(body.codigoAcompanhamento ?? '').trim();
    const paymentMethod = body.paymentMethod;

    if (!slug || !codigo || (paymentMethod !== 'PIX' && paymentMethod !== 'CARTAO')) {
      return NextResponse.json({ error: 'Dados da requisição inválidos.' }, { status: 400 });
    }

    const cartaoEmbutido = paymentMethod === 'CARTAO' ? lerDadosCartaoEmbutido(body.cartao) : null;
    if (paymentMethod === 'CARTAO' && body.cartao && !cartaoEmbutido) {
      return NextResponse.json({ error: 'Dados do cartão inválidos. Confira e tente novamente.' }, { status: 400 });
    }

    const supabase = createWebhookAdminClient();
    const { data: pedido, error: errPedido } = await supabase
      .from('pedidos')
      .select(
        `id, status, valor_total, forma_pagamento, dados_cliente, created_at, codigo_acompanhamento,
         mercado_pago_external_reference, tempo_deslocamento_min, tempo_preparo_estimado_min,
         restaurantes ( id, nome, slug, formas_pagamento_aceitas ),
         itens_pedido ( item_cardapio_id, quantidade, preco_unitario, itens_cardapio ( nome ),
                        itens_pedido_complementos ( id, nome, preco_adicional ) )`
      )
      .eq('codigo_acompanhamento', codigo)
      .maybeSingle();

    const restaurante = primeiro(pedido?.restaurantes as RestauranteRelacionado | RestauranteRelacionado[] | null);
    if (errPedido || !pedido || !restaurante || restaurante.slug !== slug) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }

    if (pedido.status === 'CANCELADO') {
      return NextResponse.json({ error: 'Este pedido foi cancelado pela loja. Faça um novo pedido pelo cardápio.' }, { status: 409 });
    }

    if (pedido.status !== 'PENDENTE') {
      return NextResponse.json({ error: 'Este pedido já foi pago ou está em andamento.' }, { status: 409 });
    }

    if (Date.now() - new Date(pedido.created_at).getTime() > PRAZO_NOVA_TENTATIVA_MS) {
      return NextResponse.json(
        { error: 'O prazo para pagar este pedido terminou. Faça um novo pedido pelo cardápio.' },
        { status: 410 }
      );
    }

    const formasAceitas = normalizarFormasPagamento(restaurante.formas_pagamento_aceitas);
    if (paymentMethod === 'PIX' && !aceitaPix(formasAceitas)) {
      return NextResponse.json({ error: 'Esta loja não está aceitando PIX no momento.' }, { status: 400 });
    }
    if (paymentMethod === 'CARTAO' && !aceitaCartao(formasAceitas)) {
      return NextResponse.json({ error: 'Esta loja não está aceitando cartão no momento.' }, { status: 400 });
    }

    // A conferência do tipo do cartão só importa quando a loja aceita APENAS crédito ou APENAS débito.
    // Aceitando os dois, qualquer crédito/débito serve (o formulário já esconde pré-pago), e uma consulta
    // que falhe ou devolva algo inesperado não deve barrar um pagamento legítimo.
    if (cartaoEmbutido && !(aceitaCartaoCredito(formasAceitas) && aceitaCartaoDebito(formasAceitas))) {
      const token = await obterTokenMercadoPagoValido(restaurante.id);
      const tiposCartao = await obterTiposMeioPagamentoMercadoPago(token, cartaoEmbutido.payment_method_id);
      // sem informação do Mercado Pago, o formulário (que já filtra por tipo) prevalece;
      // com informação, basta que algum dos tipos do cartão seja aceito pela loja
      const tipoAceito =
        tiposCartao.length === 0 ||
        tiposCartao.some(
          (tipo) =>
            (tipo === 'credit_card' && aceitaCartaoCredito(formasAceitas)) ||
            (tipo === 'debit_card' && aceitaCartaoDebito(formasAceitas))
        );
      if (!tipoAceito) {
        console.error('Cartão recusado pela regra da loja:', {
          payment_method_id: cartaoEmbutido.payment_method_id,
          payment_type_ids: tiposCartao,
          formas_aceitas: formasAceitas,
        });
        return NextResponse.json(
          {
            error: `Esta loja não aceita este tipo de cartão (${tiposCartao.join(', ') || 'desconhecido'} / ${cartaoEmbutido.payment_method_id}).`,
          },
          { status: 400 }
        );
      }
    }

    const linhas = (pedido.itens_pedido ?? []) as unknown as LinhaItemPedido[];
    const itensPrecificados: ItemPrecificado[] = linhas.map((linha) => ({
      item_cardapio_id: linha.item_cardapio_id,
      quantidade: linha.quantidade,
      nome: primeiro(linha.itens_cardapio)?.nome ?? 'Produto',
      // o preço unitário gravado no pedido já inclui os adicionais
      precoUnitario: Number(linha.preco_unitario),
      adicionais: (linha.itens_pedido_complementos ?? []).map((adicional) => ({
        id: adicional.id,
        nome: adicional.nome,
        preco_adicional: Number(adicional.preco_adicional),
      })),
    }));

    const valorTotal = Number(pedido.valor_total);
    const valorItens = itensPrecificados.reduce((acc, item) => acc + item.precoUnitario * item.quantidade, 0);
    const taxaEntrega = Math.max(0, Math.round((valorTotal - valorItens) * 100) / 100);
    const externalReference = pedido.mercado_pago_external_reference as string | null;

    if (valorTotal <= 0 || itensPrecificados.length === 0 || !externalReference) {
      return NextResponse.json({ error: 'Pedido inválido para nova tentativa de pagamento.' }, { status: 400 });
    }

    if (pedido.forma_pagamento !== paymentMethod) {
      await supabase.from('pedidos').update({ forma_pagamento: paymentMethod }).eq('id', pedido.id);
    }

    return await cobrarPedidoMercadoPago({
      appUrl,
      slug,
      restaurante: { id: restaurante.id, nome: restaurante.nome },
      pedido: { id: pedido.id, codigoAcompanhamento: pedido.codigo_acompanhamento as string },
      externalReference,
      paymentMethod,
      cartaoEmbutido,
      dadosCliente: pedido.dados_cliente as DadosClientePedido,
      itensMetadata: itensPrecificados.map((item) => ({
        item_cardapio_id: item.item_cardapio_id,
        quantidade: item.quantidade,
      })),
      itensPrecificados,
      taxaEntrega,
      valorTotal,
      formasAceitas,
      tempoPreparoEstimadoMin: pedido.tempo_preparo_estimado_min ?? null,
      tempoDeslocamentoMin: pedido.tempo_deslocamento_min ?? null,
      // cada tentativa precisa de uma chave própria, senão o Mercado Pago devolveria a tentativa anterior
      idempotencyKey: `${externalReference}-${paymentMethod.toLowerCase()}-${randomUUID()}`,
    });
  } catch (error: unknown) {
    console.error('Erro na nova tentativa de pagamento:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao iniciar nova tentativa de pagamento.' },
      { status: 500 }
    );
  }
}
