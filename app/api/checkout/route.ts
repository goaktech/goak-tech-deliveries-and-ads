import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import {
  montarMetadataPedido,
  montarNotificationUrlMercadoPago,
  normalizarEmailPayer,
  obterEmailPrincipalPix,
  obterIntegracaoMercadoPagoPorRestauranteId,
  obterTokenMercadoPagoValido,
} from '@/utils/mercado-pago';
import { criarPedidoPendente } from '@/utils/pedidos-acompanhamento';
import { calcularRotaEntrega, geocodificarEndereco, montarEnderecoParaGeocodificacao } from '@/utils/google-maps';
import { calcularTempoPreparoEstimado } from '@/utils/estimativa-chegada';
import { obterConfigLojaEspecial } from '@/utils/config-lojas-especiais';
import type { DadosClientePedido } from '@/utils/pedido-status';

const MP_API_BASE = 'https://api.mercadopago.com';

interface ItemCliente {
  item_cardapio_id: string;
  quantidade: number;
  complementoIds?: string[];
}

interface RequestBody {
  slug: string;
  paymentMethod: 'PIX' | 'CARTAO';
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
        'id, nome, slug, endereco, latitude, longitude, tempo_preparo_base_minutos, tempo_preparo_incremento_minutos, tempo_preparo_teto_minutos'
      )
      .eq('slug', slug)
      .maybeSingle();

    if (errRestaurante || !restaurante) {
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 });
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
    const taxaEntrega = dadosCliente.tipoEntrega !== 'RETIRADA' ? configLoja.taxaEntregaFixa : 0;

    const valorSacola = itensPrecificados.reduce((acc, item) => acc + item.precoUnitario * item.quantidade, 0);
    const valorTotal = valorSacola + taxaEntrega;

    if (valorTotal <= 0) {
      return NextResponse.json({ error: 'Valor total inválido.' }, { status: 400 });
    }

    const integracao = await obterIntegracaoMercadoPagoPorRestauranteId(restaurante.id);
    if (!integracao || integracao.connection_status !== 'conectado') {
      return NextResponse.json({ error: 'Mercado Pago não conectado para este restaurante.' }, { status: 409 });
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
