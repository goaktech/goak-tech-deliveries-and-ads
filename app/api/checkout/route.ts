import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import {
  obterIntegracaoMercadoPagoPorRestauranteId,
  obterTiposMeioPagamentoMercadoPago,
  obterTokenMercadoPagoValido,
} from '@/utils/mercado-pago';
import {
  cobrarPedidoMercadoPago,
  lerDadosCartaoEmbutido,
  type DadosCartaoEmbutido,
  type ItemPrecificado,
} from '@/utils/cobranca-pedido-mercado-pago';
import { criarPedidoPendente } from '@/utils/pedidos-acompanhamento';
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
} from '@/utils/formas-pagamento';

interface ItemCliente {
  item_cardapio_id: string;
  quantidade: number;
  complementoIds?: string[];
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
    // A conferência do tipo do cartão só importa quando a loja aceita APENAS crédito ou APENAS débito.
    // Aceitando os dois, qualquer crédito/débito serve (o formulário já esconde pré-pago), e uma consulta
    // que falhe ou devolva algo inesperado não deve barrar um pagamento legítimo.
    if (cartaoEmbutido && !(aceitaCartaoCredito(formasAceitas) && aceitaCartaoDebito(formasAceitas))) {
      const tokenParaValidacao = await obterTokenMercadoPagoValido(restaurante.id);
      const tiposCartao = await obterTiposMeioPagamentoMercadoPago(tokenParaValidacao, cartaoEmbutido.payment_method_id);
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

    return await cobrarPedidoMercadoPago({
      appUrl,
      slug,
      restaurante: { id: restaurante.id, nome: restaurante.nome },
      pedido: { id: pedido.id, codigoAcompanhamento: pedido.codigoAcompanhamento },
      externalReference,
      paymentMethod,
      cartaoEmbutido,
      dadosCliente,
      itensMetadata: itens,
      itensPrecificados,
      taxaEntrega,
      valorTotal,
      formasAceitas,
      tempoPreparoEstimadoMin,
      tempoDeslocamentoMin,
      idempotencyKey: `${externalReference}-${paymentMethod.toLowerCase()}`,
    });
  } catch (error: unknown) {
    console.error('Erro crítico na rota de checkout Mercado Pago:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
