import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import {
  montarMetadataPedido,
  montarNotificationUrlMercadoPago,
  normalizarEmailPayer,
  obterEmailPrincipalPix,
  obterIntegracaoMercadoPagoPorRestauranteId,
  obterTipoMeioPagamentoMercadoPago,
  obterTokenMercadoPagoValido,
} from '@/utils/mercado-pago';
import { atualizarStatusPedidoComNotificacoes, criarPedidoPendente } from '@/utils/pedidos-acompanhamento';
import { calcularRotaEntrega, geocodificarEndereco, montarEnderecoParaGeocodificacao } from '@/utils/google-maps';
import { calcularTempoPreparoEstimado } from '@/utils/estimativa-chegada';
import { calcularTaxaEntrega, ehBebida, obterConfigLojaEspecial } from '@/utils/config-lojas-especiais';
import type { DadosClientePedido } from '@/utils/pedido-status';
import {
  aceitaCartao,
  aceitaCartaoCredito,
  aceitaCartaoDebito,
  aceitaPix,
  normalizarFormasPagamento,
  tiposMercadoPagoExcluidos,
} from '@/utils/formas-pagamento';

const MP_API_BASE = 'https://api.mercadopago.com';

interface ItemCliente {
  item_cardapio_id: string;
  quantidade: number;
  complementoIds?: string[];
}

/** Dados gerados pelo formulário de cartão embutido (Card Payment Brick). O cartão em si nunca chega aqui: só o token. */
interface DadosCartaoEmbutido {
  token: string;
  payment_method_id: string;
  issuer_id?: string | number | null;
  installments?: number;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
  device_id?: string | null;
}

interface RequestBody {
  slug: string;
  paymentMethod: 'PIX' | 'CARTAO';
  /** Presente quando o cartão é pago no formulário embutido; ausente = Checkout Pro do Mercado Pago. */
  cartao?: DadosCartaoEmbutido;
  itens: ItemCliente[];
  dadosCliente: DadosClientePedido;
  clienteLatitude?: number | null;
  clienteLongitude?: number | null;
}

interface ItemCardapioPrecificado {
  id: string;
  nome: string;
  preco_venda: number;
}

interface ComplementoPrecificado {
  id: string;
  item_cardapio_id: string;
  nome: string;
  preco_adicional: number;
  disponivel: boolean;
}

interface ItemPrecificado {
  item_cardapio_id: string;
  quantidade: number;
  nome: string;
  precoUnitario: number;
  adicionais: Array<{ id: string; nome: string; preco_adicional: number }>;
}

function lerDadosCartaoEmbutido(valor: unknown): DadosCartaoEmbutido | null {
  if (!valor || typeof valor !== 'object') return null;
  const cartao = valor as DadosCartaoEmbutido;
  const documento = cartao.payer?.identification;
  if (typeof cartao.token !== 'string' || !cartao.token.trim()) return null;
  if (typeof cartao.payment_method_id !== 'string' || !cartao.payment_method_id.trim()) return null;
  if (typeof documento?.type !== 'string' || typeof documento?.number !== 'string') return null;
  return cartao;
}

const MENSAGENS_RECUSA_CARTAO: Record<string, string> = {
  cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente no cartão. Tente outro cartão.',
  cc_rejected_bad_filled_card_number: 'Confira o número do cartão.',
  cc_rejected_bad_filled_date: 'Confira a data de validade do cartão.',
  cc_rejected_bad_filled_security_code: 'Confira o código de segurança (CVV).',
  cc_rejected_bad_filled_other: 'Confira os dados do cartão e tente novamente.',
  cc_rejected_call_for_authorize: 'Seu banco precisa autorizar este pagamento. Fale com o banco ou use outro cartão.',
  cc_rejected_card_disabled: 'Este cartão está desabilitado. Ative-o com o banco ou use outro cartão.',
  cc_rejected_duplicated_payment: 'Você já fez um pagamento igual a este. Confira o acompanhamento do pedido.',
  cc_rejected_high_risk: 'Não foi possível aprovar este pagamento por segurança. Tente outro cartão ou PIX.',
  cc_rejected_max_attempts: 'Limite de tentativas atingido. Tente outro cartão ou PIX.',
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha no servidor de checkout.';
}

async function lerBody(request: Request) {
  try {
    return (await request.json()) as Partial<RequestBody>;
  } catch {
    return {};
  }
}

function validarItens(itens: ItemCliente[]) {
  return itens.every(
    (item) =>
      typeof item.item_cardapio_id === 'string' &&
      item.item_cardapio_id.length > 0 &&
      Number.isInteger(item.quantidade) &&
      item.quantidade > 0 &&
      (item.complementoIds === undefined ||
        (Array.isArray(item.complementoIds) && item.complementoIds.every((id) => typeof id === 'string')))
  );
}

export async function POST(request: Request) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: 'URL pública da aplicação não configurada.' }, { status: 500 });
    }

    const body = await lerBody(request);
    const slug = String(body.slug ?? '').trim();
    const paymentMethod = body.paymentMethod;
    const itens = Array.isArray(body.itens) ? body.itens : [];
    const cartaoEmbutido = paymentMethod === 'CARTAO' ? lerDadosCartaoEmbutido(body.cartao) : null;
    if (paymentMethod === 'CARTAO' && body.cartao && !cartaoEmbutido) {
      return NextResponse.json({ error: 'Dados do cartão inválidos. Confira e tente novamente.' }, { status: 400 });
    }
    const dadosCliente = (body.dadosCliente ?? {}) as DadosClientePedido;
    const coordenadaClienteRecebida =
      typeof body.clienteLatitude === 'number' && typeof body.clienteLongitude === 'number'
        ? { latitude: body.clienteLatitude, longitude: body.clienteLongitude }
        : null;

    if (!slug || itens.length === 0) {
      return NextResponse.json({ error: 'Dados da requisição inválidos.' }, { status: 400 });
    }

    if (paymentMethod !== 'PIX' && paymentMethod !== 'CARTAO') {
      return NextResponse.json({ error: 'Forma de pagamento inválida.' }, { status: 400 });
    }

    if (!dadosCliente.nome?.trim() || !dadosCliente.telefone?.trim()) {
      return NextResponse.json({ error: 'Dados do cliente inválidos.' }, { status: 400 });
    }

    if (!validarItens(itens)) {
      return NextResponse.json({ error: 'Itens do carrinho inválidos.' }, { status: 400 });
    }

    const supabase = createWebhookAdminClient();
    const { data: restaurante, error: errRestaurante } = await supabase
      .from('restaurantes')
      .select(
        'id, nome, slug, endereco, latitude, longitude, tempo_preparo_base_minutos, tempo_preparo_incremento_minutos, tempo_preparo_teto_minutos, formas_pagamento_aceitas'
      )
      .eq('slug', slug)
      .maybeSingle();

    if (errRestaurante || !restaurante) {
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 });
    }

    // Só aceita a forma de pagamento que o gestor habilitou para esta loja
    // (a tela do cliente também esconde as demais, mas a regra vale aqui).
    const formasAceitas = normalizarFormasPagamento(restaurante.formas_pagamento_aceitas);
    if (paymentMethod === 'PIX' && !aceitaPix(formasAceitas)) {
      return NextResponse.json({ error: 'Esta loja não está aceitando PIX no momento.' }, { status: 400 });
    }
    if (paymentMethod === 'CARTAO' && !aceitaCartao(formasAceitas)) {
      return NextResponse.json({ error: 'Esta loja não está aceitando cartão no momento.' }, { status: 400 });
    }

    const idsProdutos = itens.map((item) => item.item_cardapio_id);
    const { data: produtosBanco, error: errProdutos } = await supabase
      .from('itens_cardapio')
      .select('id, nome, preco_venda')
      .eq('restaurante_id', restaurante.id)
      .in('id', idsProdutos);

    if (errProdutos || !produtosBanco || produtosBanco.length !== idsProdutos.length) {
      return NextResponse.json({ error: 'Carrinho vazio ou inválido.' }, { status: 400 });
    }

    const produtos = produtosBanco as ItemCardapioPrecificado[];
    const produtoPorId = new Map(produtos.map((item) => [item.id, item]));

    const idsComplementos = Array.from(
      new Set(itens.flatMap((item) => item.complementoIds ?? []))
    );

    let complementosBanco: ComplementoPrecificado[] = [];
    if (idsComplementos.length > 0) {
      const { data: complementosData, error: errComplementos } = await supabase
        .from('complementos_produto')
        .select('id, item_cardapio_id, nome, preco_adicional, disponivel')
        .in('id', idsComplementos);

      if (errComplementos) {
        return NextResponse.json({ error: 'Não foi possível validar os adicionais do carrinho.' }, { status: 400 });
      }
      complementosBanco = (complementosData ?? []) as ComplementoPrecificado[];
    }
    const complementoPorId = new Map(complementosBanco.map((c) => [c.id, c]));

    const itensPrecificados: ItemPrecificado[] = itens.map((item) => {
      const produto = produtoPorId.get(item.item_cardapio_id);
      const precoBase = produto ? Number(produto.preco_venda) : 0;

      const adicionaisValidos = (item.complementoIds ?? [])
        .map((id) => complementoPorId.get(id))
        .filter(
          (complemento): complemento is ComplementoPrecificado =>
            !!complemento &&
            complemento.item_cardapio_id === item.item_cardapio_id &&
            complemento.disponivel === true
        )
        .map((complemento) => ({
          id: complemento.id,
          nome: complemento.nome,
          preco_adicional: Number(complemento.preco_adicional),
        }));

      const precoAdicionais = adicionaisValidos.reduce((acc, adicional) => acc + adicional.preco_adicional, 0);

      return {
        item_cardapio_id: item.item_cardapio_id,
        quantidade: item.quantidade,
        nome: produto?.nome ?? 'Produto',
        precoUnitario: precoBase + precoAdicionais,
        adicionais: adicionaisValidos,
      };
    });

    const configLoja = obterConfigLojaEspecial(restaurante.slug);
    // A taxa é sempre calculada aqui, no servidor (nunca confiamos no valor do navegador).
    // Lojas com tabela por bairro exigem um bairro da lista; retirada nunca paga taxa.
    const calculoTaxa = calcularTaxaEntrega(configLoja, dadosCliente.tipoEntrega, dadosCliente.endereco?.bairro);
    if (!calculoTaxa.ok) {
      return NextResponse.json({ error: calculoTaxa.erro }, { status: 400 });
    }
    const taxaEntrega = calculoTaxa.taxa;
    if (calculoTaxa.zona && dadosCliente.endereco) {
      // grava no pedido o nome oficial da localidade (o mesmo da tabela de taxas)
      dadosCliente.endereco = { ...dadosCliente.endereco, bairro: calculoTaxa.zona.nome };
    }

    const valorSacola = itensPrecificados.reduce((acc, item) => acc + item.precoUnitario * item.quantidade, 0);
    const valorTotal = valorSacola + taxaEntrega;

    if (valorTotal <= 0) {
      return NextResponse.json({ error: 'Valor total inválido.' }, { status: 400 });
    }

    if (configLoja.limiteUnidadesComida) {
      const totalUnidadesComida = itensPrecificados
        .filter((item) => !ehBebida(item.nome))
        .reduce((acc, item) => acc + item.quantidade, 0);

      if (totalUnidadesComida > configLoja.limiteUnidadesComida) {
        return NextResponse.json(
          {
            error: `Limite de ${configLoja.limiteUnidadesComida} unidades por pedido excedido para este item. Reduza a quantidade e tente novamente.`,
          },
          { status: 400 }
        );
      }
    }

    const integracao = await obterIntegracaoMercadoPagoPorRestauranteId(restaurante.id);
    if (!integracao || integracao.connection_status !== 'conectado') {
      return NextResponse.json({ error: 'Mercado Pago não conectado para este restaurante.' }, { status: 409 });
    }

    // Cartão embutido: confere ANTES de criar o pedido se o tipo do cartão (crédito/débito) é aceito pela loja.
    if (cartaoEmbutido) {
      const tokenParaValidacao = await obterTokenMercadoPagoValido(restaurante.id);
      const tipoCartao = await obterTipoMeioPagamentoMercadoPago(tokenParaValidacao, cartaoEmbutido.payment_method_id);
      const tipoAceito =
        tipoCartao === null ||
        (tipoCartao === 'credit_card' && aceitaCartaoCredito(formasAceitas)) ||
        (tipoCartao === 'debit_card' && aceitaCartaoDebito(formasAceitas));
      if (!tipoAceito) {
        return NextResponse.json({ error: 'Esta loja não aceita este tipo de cartão.' }, { status: 400 });
      }
    }

    let clienteLatitude: number | null = null;
    let clienteLongitude: number | null = null;
    let distanciaEntregaKm: number | null = null;
    let tempoDeslocamentoMin: number | null = null;

    if (dadosCliente.tipoEntrega !== 'RETIRADA') {
      try {
        let origemLoja =
          typeof restaurante.latitude === 'number' && typeof restaurante.longitude === 'number'
            ? { latitude: restaurante.latitude, longitude: restaurante.longitude }
            : null;

        if (!origemLoja && restaurante.endereco) {
          origemLoja = await geocodificarEndereco(restaurante.endereco);
          if (origemLoja) {
            await supabase
              .from('restaurantes')
              .update({ latitude: origemLoja.latitude, longitude: origemLoja.longitude })
              .eq('id', restaurante.id);
          }
        }

        let destinoCliente = coordenadaClienteRecebida;
        if (!destinoCliente) {
          const enderecoClienteTexto = dadosCliente.endereco
            ? montarEnderecoParaGeocodificacao(dadosCliente.endereco)
            : '';
          destinoCliente = enderecoClienteTexto ? await geocodificarEndereco(enderecoClienteTexto) : null;
        }

        if (destinoCliente) {
          clienteLatitude = destinoCliente.latitude;
          clienteLongitude = destinoCliente.longitude;
        }

        if (origemLoja && destinoCliente) {
          const rota = await calcularRotaEntrega(origemLoja, destinoCliente);
          if (rota) {
            distanciaEntregaKm = rota.distanciaKm;
            tempoDeslocamentoMin = rota.duracaoMinutos;
          }
        }
      } catch (error) {
        console.error('Falha ao calcular geolocalização/distância no checkout (seguindo sem estimativa):', error);
      }
    }

    const { count: pedidosNaFila } = await supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('restaurante_id', restaurante.id)
      .in('status', ['PENDENTE', 'PAGO', 'PREPARANDO']);

    const tempoPreparoEstimadoMin = calcularTempoPreparoEstimado(
      {
        baseMinutos: restaurante.tempo_preparo_base_minutos ?? 20,
        incrementoPorPedidoMinutos: restaurante.tempo_preparo_incremento_minutos ?? 3,
        tetoMinutos: restaurante.tempo_preparo_teto_minutos ?? 60,
      },
      pedidosNaFila ?? 0
    );

    const externalReference = `pedido-${restaurante.id}-${Date.now()}-${randomUUID()}`;
    const pedido = await criarPedidoPendente({
      restauranteId: restaurante.id,
      formaPagamento: paymentMethod,
      dadosCliente,
      valorTotal,
      externalReference,
      clienteLatitude,
      clienteLongitude,
      distanciaEntregaKm,
      tempoDeslocamentoMin,
      tempoPreparoEstimadoMin,
      itens: itensPrecificados.map((item) => ({
        item_cardapio_id: item.item_cardapio_id,
        quantidade: item.quantidade,
        preco_unitario: item.precoUnitario,
        adicionais: item.adicionais,
      })),
    });

    const trackingUrl = `${appUrl}/${slug}/acompanhar/${pedido.codigoAcompanhamento}`;
    const accessToken = await obterTokenMercadoPagoValido(restaurante.id);
    const notificationUrl = montarNotificationUrlMercadoPago(appUrl, restaurante.id);
    const metadata = montarMetadataPedido({
      slug,
      pedidoId: pedido.id,
      codigoAcompanhamento: pedido.codigoAcompanhamento,
      externalReference,
      restauranteId: restaurante.id,
      metodoPagamento: paymentMethod,
      dadosCliente,
      itens,
    });
    const emailPayer = normalizarEmailPayer(dadosCliente.email, slug, dadosCliente.telefone);
    const idempotencyKey = `${externalReference}-${paymentMethod.toLowerCase()}`;

    if (paymentMethod === 'PIX') {
      const response = await fetch(`${MP_API_BASE}/v1/payments`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: Number(valorTotal.toFixed(2)),
          description: `${restaurante.nome} - Pedido`,
          payment_method_id: 'pix',
          notification_url: notificationUrl,
          external_reference: externalReference,
          payer: {
            email: obterEmailPrincipalPix(),
            first_name: dadosCliente.nome.trim().split(/\s+/)[0],
            last_name: dadosCliente.nome.trim().split(/\s+/).slice(1).join(' ') || 'Cliente',
          },
          metadata,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'Falha ao gerar pagamento PIX.');
      }

      const transactionData = payload?.point_of_interaction?.transaction_data ?? {};

      return NextResponse.json({
        pedido_id: pedido.id,
        codigo_acompanhamento: pedido.codigoAcompanhamento,
        tracking_url: trackingUrl,
        payment_id: payload.id,
        qr_code: transactionData.qr_code ?? '',
        qr_code_base64: transactionData.qr_code_base64 ?? '',
        ticket_url: transactionData.ticket_url ?? '',
        tempo_preparo_estimado_min: tempoPreparoEstimadoMin,
        tempo_deslocamento_min: tempoDeslocamentoMin,
      });
    }

    if (cartaoEmbutido) {
      const nomeCompleto = dadosCliente.nome.trim();
      const headers: Record<string, string> = {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        'x-idempotency-key': idempotencyKey,
      };
      if (cartaoEmbutido.device_id) {
        headers['x-meli-session-id'] = String(cartaoEmbutido.device_id);
      }

      const emissor = Number(cartaoEmbutido.issuer_id);
      const pagamentoResponse = await fetch(`${MP_API_BASE}/v1/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          // o valor é SEMPRE o calculado aqui no servidor, nunca o do navegador
          transaction_amount: Number(valorTotal.toFixed(2)),
          token: cartaoEmbutido.token,
          description: `${restaurante.nome} - Pedido`,
          installments: 1,
          payment_method_id: cartaoEmbutido.payment_method_id,
          ...(Number.isFinite(emissor) && emissor > 0 ? { issuer_id: emissor } : {}),
          notification_url: notificationUrl,
          external_reference: externalReference,
          payer: {
            email: cartaoEmbutido.payer?.email?.trim() || emailPayer,
            first_name: nomeCompleto.split(/\s+/)[0],
            last_name: nomeCompleto.split(/\s+/).slice(1).join(' ') || 'Cliente',
            identification: {
              type: String(cartaoEmbutido.payer?.identification?.type),
              number: String(cartaoEmbutido.payer?.identification?.number).replace(/\D/g, ''),
            },
          },
          additional_info: {
            items: itensPrecificados.map((item) => ({
              id: item.item_cardapio_id,
              title: item.nome,
              quantity: item.quantidade,
              unit_price: item.precoUnitario,
            })),
          },
          metadata,
        }),
      });

      const pagamento = await pagamentoResponse.json();
      if (!pagamentoResponse.ok) {
        console.error('Mercado Pago recusou a criação do pagamento com cartão:', pagamento);
        return NextResponse.json(
          { error: 'Não foi possível processar o cartão. Confira os dados e tente novamente.' },
          { status: 400 }
        );
      }

      const statusPagamento = String(pagamento?.status ?? '');
      const respostaBase = {
        pedido_id: pedido.id,
        codigo_acompanhamento: pedido.codigoAcompanhamento,
        tracking_url: trackingUrl,
        payment_id: pagamento.id,
        tempo_preparo_estimado_min: tempoPreparoEstimadoMin,
        tempo_deslocamento_min: tempoDeslocamentoMin,
      };

      if (statusPagamento === 'approved') {
        try {
          // o webhook também fará isso (é idempotente); aqui só adianta a confirmação para o cliente
          await atualizarStatusPedidoComNotificacoes({
            pedidoId: pedido.id,
            novoStatus: 'PAGO',
            mercadoPagoPaymentId: String(pagamento.id),
          });
        } catch (erroAtualizacao) {
          console.error('Pagamento aprovado, mas falhou ao atualizar o pedido (o webhook concilia):', erroAtualizacao);
        }
        return NextResponse.json({ ...respostaBase, status: 'approved' });
      }

      if (statusPagamento === 'rejected') {
        const detalhe = String(pagamento?.status_detail ?? '');
        return NextResponse.json({
          ...respostaBase,
          status: 'rejected',
          mensagem:
            MENSAGENS_RECUSA_CARTAO[detalhe] ??
            'O pagamento foi recusado. Tente outro cartão ou escolha PIX.',
        });
      }

      // in_process / pending: o webhook confirma depois; a tela de acompanhamento atualiza sozinha
      return NextResponse.json({ ...respostaBase, status: 'in_process' });
    }

    const itensPreferencia = itensPrecificados.map((item) => ({
      id: item.item_cardapio_id,
      title:
        item.adicionais.length > 0
          ? `${item.nome} (+ ${item.adicionais.map((adicional) => adicional.nome).join(', ')})`
          : item.nome,
      quantity: item.quantidade,
      unit_price: item.precoUnitario,
      currency_id: 'BRL',
    }));

    if (taxaEntrega > 0) {
      itensPreferencia.push({
        id: 'taxa-entrega',
        title: 'Taxa de entrega',
        quantity: 1,
        unit_price: taxaEntrega,
        currency_id: 'BRL',
      });
    }

    const preferenceResponse = await fetch(`${MP_API_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        items: itensPreferencia,
        // mostra no checkout do Mercado Pago só crédito e/ou débito, conforme a loja aceita
        payment_methods: {
          excluded_payment_types: tiposMercadoPagoExcluidos(formasAceitas),
        },
        payer: {
          email: emailPayer,
        },
        external_reference: externalReference,
        notification_url: notificationUrl,
        back_urls: {
          success: `${trackingUrl}?pagamento=aprovado`,
          pending: `${trackingUrl}?pagamento=pendente`,
          failure: `${trackingUrl}?pagamento=falhou`,
        },
        auto_return: 'approved',
        metadata,
      }),
    });

    const preferencePayload = await preferenceResponse.json();
    if (!preferenceResponse.ok) {
      throw new Error(preferencePayload?.message || 'Falha ao gerar checkout com cartão.');
    }

    return NextResponse.json({
      pedido_id: pedido.id,
      codigo_acompanhamento: pedido.codigoAcompanhamento,
      tracking_url: trackingUrl,
      preference_id: preferencePayload.id,
      checkout_url: preferencePayload.init_point ?? preferencePayload.sandbox_init_point ?? '',
    });
  } catch (error: unknown) {
    console.error('Erro crítico na rota de checkout Mercado Pago:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
