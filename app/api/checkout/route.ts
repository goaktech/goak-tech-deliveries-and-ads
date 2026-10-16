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
import { buscarPedidoPorExternalReference, criarPedidoPendente } from '@/utils/pedidos-acompanhamento';
import { calcularRotaEntrega, geocodificarEndereco, montarEnderecoParaGeocodificacao } from '@/utils/google-maps';
import { type TaxaEntregaIfoodCheckout, cotarTaxaEntregaIfoodCheckout, lojaEntregaPeloIfood } from '@/utils/ifood-entrega';
import { calcularTempoPreparoEstimado } from '@/utils/estimativa-chegada';
import { calcularTaxaEntrega, ehBebida, obterConfigLojaEspecial } from '@/utils/config-lojas-especiais';
import { type DadosClientePedido, normalizarObservacoesPedido } from '@/utils/pedido-status';
import { telefoneValido } from '@/utils/telefone';
import { estaLojaAberta, type HorarioFuncionamentoDia } from '@/utils/horario-funcionamento';
import {
  STATUS_QUE_BLOQUEIAM,
  avaliarItensCarrinho,
  type AdicionalVisto,
} from '@/utils/politica-preco';
import {
  aceitaCartao,
  aceitaCartaoCredito,
  aceitaCartaoDebito,
  aceitaPix,
  normalizarFormasPagamento,
} from '@/utils/formas-pagamento';

interface ItemCliente {
  idUnico?: string;
  item_cardapio_id: string;
  quantidade: number;
  complementoIds?: string[];
  adicionaisVistos?: AdicionalVisto[];
  precoVisto?: number;
}

interface RequestBody {
  slug: string;
  paymentMethod: 'PIX' | 'CARTAO';
  cartao?: DadosCartaoEmbutido;
  itens: ItemCliente[];
  dadosCliente: DadosClientePedido;
  clienteLatitude?: number | null;
  clienteLongitude?: number | null;
  valorTotalExibido?: number;
  checkoutId?: string;
  fbp?: string | null;
  fbc?: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function respostaCheckoutDuplicado(
  pedido: { id: string; codigo_acompanhamento: string; status: string },
  slug: string,
  appUrl: string
) {
  return NextResponse.json(
    {
      error: 'Este pedido já foi registrado. Redirecionando para o acompanhamento.',
      duplicado: true,
      pedido_id: pedido.id,
      codigo_acompanhamento: pedido.codigo_acompanhamento,
      tracking_url: `${appUrl}/${slug}/acompanhar/${pedido.codigo_acompanhamento}`,
    },
    { status: 409 }
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
    const lerIdentificadorMeta = (valor: unknown): string | null =>
      typeof valor === 'string' && /^[\w.\-]{1,255}$/.test(valor.trim()) ? valor.trim() : null;
    const fbp = lerIdentificadorMeta(body.fbp);
    const fbc = lerIdentificadorMeta(body.fbc);
    const clienteIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 64) || null;
    const clienteUserAgent = request.headers.get('user-agent')?.slice(0, 500) || null;
    const observacoesCliente = normalizarObservacoesPedido(dadosCliente.observacoes);
    if (observacoesCliente) {
      dadosCliente.observacoes = observacoesCliente;
    } else {
      delete dadosCliente.observacoes;
    }
    let coordenadaClienteRecebida =
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
    if (!telefoneValido(String(dadosCliente.telefone))) {
      return NextResponse.json({ error: 'Informe o WhatsApp com DDD, ex.: (11) 99999-9999.' }, { status: 400 });
    }

    if (!validarItens(itens)) {
      return NextResponse.json({ error: 'Itens do carrinho inválidos.' }, { status: 400 });
    }

    const supabase = createWebhookAdminClient();
    const { data: restaurante, error: errRestaurante } = await supabase
      .from('restaurantes')
      .select(
        'id, nome, slug, endereco, latitude, longitude, tempo_preparo_base_minutos, tempo_preparo_incremento_minutos, tempo_preparo_teto_minutos, formas_pagamento_aceitas, horarios_funcionamento'
      )
      .eq('slug', slug)
      .maybeSingle();

    if (errRestaurante || !restaurante) {
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 });
    }

    const formasAceitas = normalizarFormasPagamento(restaurante.formas_pagamento_aceitas);
    if (paymentMethod === 'PIX' && !aceitaPix(formasAceitas)) {
      return NextResponse.json({ error: 'Esta loja não está aceitando PIX no momento.' }, { status: 400 });
    }
    if (paymentMethod === 'CARTAO' && !aceitaCartao(formasAceitas)) {
      return NextResponse.json({ error: 'Esta loja não está aceitando cartão no momento.' }, { status: 400 });
    }

    if (!estaLojaAberta(restaurante.horarios_funcionamento as HorarioFuncionamentoDia[] | null)) {
      return NextResponse.json(
        { error: 'A loja está fechada no momento. Volte no horário de funcionamento para finalizar o pedido.', codigo: 'LOJA_FECHADA' },
        { status: 409 }
      );
    }

    const checkoutId = typeof body.checkoutId === 'string' && UUID_REGEX.test(body.checkoutId) ? body.checkoutId.toLowerCase() : null;
    const externalReference = checkoutId
      ? `pedido-${restaurante.id}-${checkoutId}`
      : `pedido-${restaurante.id}-${Date.now()}-${randomUUID()}`;

    if (checkoutId) {
      const existente = await buscarPedidoPorExternalReference(externalReference);
      if (existente) {
        return respostaCheckoutDuplicado(existente, slug, appUrl);
      }
    }

    const avaliacoes = await avaliarItensCarrinho({
      supabase,
      restauranteId: restaurante.id,
      horarios: restaurante.horarios_funcionamento as HorarioFuncionamentoDia[] | null,
      itens,
    });

    if (avaliacoes.some((avaliacao) => STATUS_QUE_BLOQUEIAM.includes(avaliacao.status))) {
      return NextResponse.json(
        {
          error: 'Alguns itens do seu carrinho mudaram. Confira os valores atualizados antes de pagar.',
          codigo: 'CARRINHO_DESATUALIZADO',
          itens: avaliacoes,
        },
        { status: 409 }
      );
    }

    const itensPrecificados: ItemPrecificado[] = itens.map((item, indice) => {
      const avaliacao = avaliacoes[indice];
      return {
        item_cardapio_id: item.item_cardapio_id,
        quantidade: item.quantidade,
        nome: avaliacao.nome,
        precoUnitario: avaliacao.precoCobrado,
        adicionais: avaliacao.adicionais,
      };
    });

    const configLoja = obterConfigLojaEspecial(restaurante.slug);

    let taxaIfood: TaxaEntregaIfoodCheckout | null = null;
    if (dadosCliente.tipoEntrega !== 'RETIRADA' && (await lojaEntregaPeloIfood(restaurante.id))) {
      if (!coordenadaClienteRecebida && dadosCliente.endereco) {
        const enderecoTexto = montarEnderecoParaGeocodificacao(dadosCliente.endereco);
        coordenadaClienteRecebida = enderecoTexto ? await geocodificarEndereco(enderecoTexto) : null;
      }
      if (coordenadaClienteRecebida) {
        taxaIfood = await cotarTaxaEntregaIfoodCheckout(restaurante.id, coordenadaClienteRecebida);
      }
    }

    let taxaEntrega: number;
    if (taxaIfood) {
      taxaEntrega = taxaIfood.taxaCliente;
    } else {
      const calculoTaxa = calcularTaxaEntrega(configLoja, dadosCliente.tipoEntrega, dadosCliente.endereco?.bairro);
      if (!calculoTaxa.ok) {
        return NextResponse.json({ error: calculoTaxa.erro }, { status: 400 });
      }
      taxaEntrega = calculoTaxa.taxa;
      if (calculoTaxa.zona && dadosCliente.endereco) {
        dadosCliente.endereco = { ...dadosCliente.endereco, bairro: calculoTaxa.zona.nome };
      }
    }

    const valorSacola = itensPrecificados.reduce((acc, item) => acc + item.precoUnitario * item.quantidade, 0);
    const valorTotal = valorSacola + taxaEntrega;

    if (valorTotal <= 0) {
      return NextResponse.json({ error: 'Valor total inválido.' }, { status: 400 });
    }

    const totalExibido = Number(body.valorTotalExibido);
    if (Number.isFinite(totalExibido) && totalExibido > 0 && valorTotal - totalExibido > 0.009) {
      return NextResponse.json(
        {
          error: `O valor total mudou para ${valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Confira e confirme para continuar.`,
          codigo: 'VALOR_DIVERGENTE',
          valorAtual: valorTotal,
          valorExibido: totalExibido,
        },
        { status: 409 }
      );
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

    if (cartaoEmbutido && !(aceitaCartaoCredito(formasAceitas) && aceitaCartaoDebito(formasAceitas))) {
      const tokenParaValidacao = await obterTokenMercadoPagoValido(restaurante.id);
      const tiposCartao = await obterTiposMeioPagamentoMercadoPago(tokenParaValidacao, cartaoEmbutido.payment_method_id);
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

    let pedido: Awaited<ReturnType<typeof criarPedidoPendente>>;
    try {
      pedido = await criarPedidoPendente({
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
        fbp,
        fbc,
        clienteIp,
        clienteUserAgent,
        itens: itensPrecificados.map((item) => ({
          item_cardapio_id: item.item_cardapio_id,
          quantidade: item.quantidade,
          preco_unitario: item.precoUnitario,
          adicionais: item.adicionais,
        })),
      });
    } catch (erroCriacao) {
      const codigo = (erroCriacao as { code?: string } | null)?.code;
      if (codigo === '23505' && checkoutId) {
        const existente = await buscarPedidoPorExternalReference(externalReference);
        if (existente) {
          return respostaCheckoutDuplicado(existente, slug, appUrl);
        }
      }
      throw erroCriacao;
    }

    if (taxaIfood) {
      const { error: errCotacao } = await supabase
        .from('pedidos')
        .update({ ifood_cotacao: { ...taxaIfood.cotacao, taxaCobradaCliente: taxaIfood.taxaCliente } })
        .eq('id', pedido.id);
      if (errCotacao) {
        console.error('Falha ao guardar a cotação do iFood no pedido:', errCotacao);
      }
    }

    return await cobrarPedidoMercadoPago({
      appUrl,
      slug,
      restaurante: { id: restaurante.id, nome: restaurante.nome },
      pedido: { id: pedido.id, codigoAcompanhamento: pedido.codigoAcompanhamento },
      externalReference,
      paymentMethod,
      cartaoEmbutido,
      dadosCliente,
      itensMetadata: itens.map((item) => ({ item_cardapio_id: item.item_cardapio_id, quantidade: item.quantidade, complementoIds: item.complementoIds })),
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
    return NextResponse.json({ error: 'Falha ao processar o pagamento. Tente novamente.' }, { status: 500 });
  }
}
