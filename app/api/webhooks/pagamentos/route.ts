import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import {
  atualizarStatusPedidoComNotificacoes,
  buscarPedidoPorExternalReference,
  criarPedidoPendente,
} from '@/utils/pedidos-acompanhamento';
import { calcularRotaEntrega, geocodificarEndereco, montarEnderecoParaGeocodificacao } from '@/utils/google-maps';
import { calcularTempoPreparoEstimado } from '@/utils/estimativa-chegada';
import type { DadosClientePedido } from '@/utils/pedido-status';

const MP_API_BASE = 'https://api.mercadopago.com';

type NivelLogWebhook = 'info' | 'sucesso' | 'alerta' | 'erro';

interface ItemMetadado {
  item_cardapio_id: string;
  quantidade: number;
  complementoIds?: string[];
}

interface MetadataPedido {
  slug?: string;
  pedidoId?: string;
  codigoAcompanhamento?: string;
  externalReference?: string;
  restauranteId?: string;
  restaurante_id?: string;
  dadosCliente?: unknown;
  dados_cliente?: unknown;
  itens?: unknown;
  metodoPagamento?: 'PIX' | 'CARTAO';
  metodo_pagamento?: 'PIX' | 'CARTAO';
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

interface ParamsRegistrarLogWebhook {
  supabase: ReturnType<typeof createWebhookAdminClient>;
  idCorrelacao: string;
  etapa: string;
  nivel: NivelLogWebhook;
  mensagem: string;
  restauranteId?: string | null;
  paymentId?: string | null;
  tipoEvento?: string | null;
  dados?: Record<string, unknown>;
  erro?: unknown;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro interno desconhecido.';
}

function serializarErro(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      nome: error.name,
      mensagem: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'object' && error !== null) {
    return { ...(error as Record<string, unknown>) };
  }

  return { valor: String(error) };
}

function interpretarJsonMetadado<T>(valor: unknown): T | null {
  if (valor == null) {
    return null;
  }

  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (!texto) {
      return null;
    }

    try {
      return JSON.parse(texto) as T;
    } catch {
      return null;
    }
  }

  if (typeof valor === 'object') {
    return valor as T;
  }

  return null;
}

function validarItens(itens: ItemMetadado[]) {
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

function registrarConsoleWebhook({
  idCorrelacao,
  etapa,
  nivel,
  mensagem,
  restauranteId,
  paymentId,
  tipoEvento,
  dados,
  erro,
}: Omit<ParamsRegistrarLogWebhook, 'supabase'>) {
  const payloadLog = {
    contexto: 'webhook_pagamentos',
    timestamp: new Date().toISOString(),
    id_correlacao: idCorrelacao,
    etapa,
    nivel,
    mensagem,
    restaurante_id: restauranteId ?? null,
    payment_id: paymentId ?? null,
    tipo_evento: tipoEvento ?? null,
    dados: dados ?? {},
    erro: erro ? serializarErro(erro) : null,
  };

  const textoLog = JSON.stringify(payloadLog);
  if (nivel === 'erro') {
    console.error(textoLog);
    return;
  }
  if (nivel === 'alerta') {
    console.warn(textoLog);
    return;
  }
  console.log(textoLog);
}

async function registrarLogWebhook(params: ParamsRegistrarLogWebhook) {
  const {
    supabase,
    idCorrelacao,
    etapa,
    nivel,
    mensagem,
    restauranteId,
    paymentId,
    tipoEvento,
    dados,
    erro,
  } = params;

  registrarConsoleWebhook({
    idCorrelacao,
    etapa,
    nivel,
    mensagem,
    restauranteId,
    paymentId,
    tipoEvento,
    dados,
    erro,
  });

  const { error: erroInsercaoLog } = await supabase.from('logs_webhook_pagamentos').insert({
    id_correlacao: idCorrelacao,
    restaurante_id: restauranteId ?? null,
    payment_id: paymentId ?? null,
    tipo_evento: tipoEvento ?? null,
    etapa,
    nivel,
    mensagem,
    dados_json: dados ?? {},
    erro_json: erro ? serializarErro(erro) : null,
  });

  if (erroInsercaoLog) {
    console.error(
      JSON.stringify({
        contexto: 'webhook_pagamentos',
        timestamp: new Date().toISOString(),
        id_correlacao: idCorrelacao,
        etapa: 'persistencia_log',
        nivel: 'erro',
        mensagem: 'Falha ao persistir log na tabela logs_webhook_pagamentos.',
        erro: {
          codigo: erroInsercaoLog.code,
          mensagem: erroInsercaoLog.message,
          detalhe: erroInsercaoLog.details,
          hint: erroInsercaoLog.hint,
        },
      })
    );
  }
}

async function buscarPagamentoMercadoPago(accessToken: string, paymentId: string) {
  const response = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `Falha ao consultar pagamento ${paymentId}.`);
  }

  return payload as {
    id: string;
    status: string;
    payment_method_id?: string;
    metadata?: MetadataPedido;
    external_reference?: string;
    transaction_amount?: number;
  };
}

async function extrairCorpo(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const supabase = createWebhookAdminClient();
  const idCorrelacao = randomUUID();
  let etapaAtual = 'inicio';

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'validacao_configuracao',
        nivel: 'erro',
        mensagem: 'Webhook interrompido por ausência de NEXT_PUBLIC_APP_URL.',
      });
      return NextResponse.json({ error: 'URL pública da aplicação não configurada.' }, { status: 500 });
    }

    const body = await extrairCorpo(request);
    const paymentId = String(body?.data?.id ?? body?.id ?? '').trim();
    const tipoEvento = String(body?.type ?? body?.action ?? 'desconhecido');
    const restauranteIdQuery = new URL(request.url).searchParams.get('restaurante_id');

    if (!paymentId) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'validacao_payload',
        nivel: 'alerta',
        mensagem: 'Webhook recebido sem identificador do pagamento.',
        restauranteId: restauranteIdQuery,
        tipoEvento,
        dados: { body },
      });
      return NextResponse.json({ received: true });
    }

    await registrarLogWebhook({
      supabase,
      idCorrelacao,
      etapa: 'payload_recebido',
      nivel: 'info',
      mensagem: 'Webhook de pagamento recebido com payload inicial.',
      restauranteId: restauranteIdQuery,
      paymentId,
      tipoEvento,
      dados: { body },
    });

    if (!restauranteIdQuery) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'validacao_restaurante_query',
        nivel: 'alerta',
        mensagem: 'Webhook recebido sem restaurante_id na query string.',
        paymentId,
        tipoEvento,
      });
      return NextResponse.json({ error: 'restaurante_id ausente.' }, { status: 400 });
    }

    etapaAtual = 'carregamento_integracao_restaurante';
    const { data: integracao, error: errIntegracao } = await supabase
      .from('restaurante_integracoes_pagamento')
      .select('access_token, connection_status')
      .eq('restaurante_id', restauranteIdQuery)
      .eq('provedor', 'mercado_pago')
      .maybeSingle();

    if (errIntegracao || !integracao?.access_token || integracao.connection_status !== 'conectado') {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: etapaAtual,
        nivel: 'erro',
        mensagem: 'Integração Mercado Pago indisponível para este restaurante.',
        restauranteId: restauranteIdQuery,
        paymentId,
        erro: errIntegracao,
      });
      return NextResponse.json({ error: 'Integração Mercado Pago indisponível.' }, { status: 409 });
    }

    etapaAtual = 'consulta_pagamento_mercado_pago';
    const pagamento = await buscarPagamentoMercadoPago(integracao.access_token, paymentId);

    await registrarLogWebhook({
      supabase,
      idCorrelacao,
      etapa: etapaAtual,
      nivel: 'info',
      mensagem: 'Pagamento consultado com sucesso no Mercado Pago.',
      restauranteId: restauranteIdQuery,
      paymentId,
      dados: {
        status_pagamento: pagamento.status,
        external_reference: pagamento.external_reference ?? null,
      },
    });

    if (pagamento.status !== 'approved') {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'validacao_status_pagamento',
        nivel: 'info',
        mensagem: 'Pagamento ainda não aprovado; webhook encerrado sem atualização do pedido.',
        restauranteId: restauranteIdQuery,
        paymentId,
        dados: { status_pagamento: pagamento.status },
      });
      return NextResponse.json({ received: true });
    }

    etapaAtual = 'leitura_metadados_pagamento';
    const metadata = pagamento.metadata ?? {};
    const slug = String(metadata.slug ?? '').trim();
    const pedidoIdMetadata = String(metadata.pedidoId ?? '').trim();
    const dadosCliente = interpretarJsonMetadado<DadosClientePedido>(metadata.dadosCliente ?? metadata.dados_cliente);
    const itens = interpretarJsonMetadado<ItemMetadado[]>(metadata.itens) ?? [];

    let pedidoExistente: Awaited<ReturnType<typeof buscarPedidoPorExternalReference>> = null;
    if (pedidoIdMetadata) {
      const { data } = await supabase
        .from('pedidos')
        .select('id, status, mercado_pago_payment_id, restaurante_id, codigo_acompanhamento')
        .eq('id', pedidoIdMetadata)
        .maybeSingle();
      pedidoExistente = (data as Awaited<ReturnType<typeof buscarPedidoPorExternalReference>>) ?? null;
    }

    if (!pedidoExistente && pagamento.external_reference) {
      pedidoExistente = await buscarPedidoPorExternalReference(pagamento.external_reference);
    }

    if (pedidoExistente) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'pedido_existente_localizado',
        nivel: 'info',
        mensagem: 'Pedido pré-criado localizado para conciliação do pagamento.',
        restauranteId: pedidoExistente.restaurante_id,
        paymentId,
        dados: { pedido_id: pedidoExistente.id, status_atual: pedidoExistente.status },
      });

      const resultado = await atualizarStatusPedidoComNotificacoes({
        pedidoId: pedidoExistente.id,
        novoStatus: 'PAGO',
        mercadoPagoPaymentId: paymentId,
      });

      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: 'atualizacao_status_pedido_existente',
        nivel: 'sucesso',
        mensagem: resultado.mudouStatus
          ? 'Pedido existente atualizado para PAGO com sucesso.'
          : 'Webhook repetido detectado; pedido já estava sincronizado.',
        restauranteId: pedidoExistente.restaurante_id,
        paymentId,
        dados: {
          pedido_id: pedidoExistente.id,
          status_final: resultado.pedido.status,
          tracking_token: resultado.pedido.codigo_acompanhamento,
        },
      });

      return NextResponse.json({ received: true, pedido_id: pedidoExistente.id });
    }

    if (!slug) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: etapaAtual,
        nivel: 'alerta',
        mensagem: 'Pagamento aprovado sem slug nos metadados e sem pedido prévio localizável.',
        restauranteId: restauranteIdQuery,
        paymentId,
      });
      return NextResponse.json({ error: 'Slug do restaurante ausente nos metadados.' }, { status: 400 });
    }

    if (!dadosCliente || typeof dadosCliente.nome !== 'string' || typeof dadosCliente.telefone !== 'string') {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: etapaAtual,
        nivel: 'alerta',
        mensagem: 'Dados do cliente inválidos nos metadados do pagamento.',
        restauranteId: restauranteIdQuery,
        paymentId,
      });
      return NextResponse.json({ error: 'Dados do cliente inválidos.' }, { status: 400 });
    }

    if (!Array.isArray(itens) || itens.length === 0 || !validarItens(itens)) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: etapaAtual,
        nivel: 'alerta',
        mensagem: 'Itens inválidos nos metadados do pagamento.',
        restauranteId: restauranteIdQuery,
        paymentId,
      });
      return NextResponse.json({ error: 'Itens do pagamento inválidos.' }, { status: 400 });
    }

    etapaAtual = 'busca_restaurante_por_slug';
    const { data: restaurante, error: errRestaurante } = await supabase
      .from('restaurantes')
      .select(
        'id, nome, slug, endereco, latitude, longitude, tempo_preparo_base_minutos, tempo_preparo_incremento_minutos, tempo_preparo_teto_minutos'
      )
      .eq('slug', slug)
      .maybeSingle();

    if (errRestaurante || !restaurante) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: etapaAtual,
        nivel: 'erro',
        mensagem: 'Restaurante não localizado para o slug do pagamento.',
        restauranteId: restauranteIdQuery,
        paymentId,
        dados: { slug },
        erro: errRestaurante,
      });
      return NextResponse.json({ error: 'Restaurante não localizado.' }, { status: 404 });
    }

    etapaAtual = 'busca_precos_itens';
    const idsProdutos = itens.map((item) => item.item_cardapio_id);
    const { data: produtosBanco, error: errProdutos } = await supabase
      .from('itens_cardapio')
      .select('id, nome, preco_venda')
      .eq('restaurante_id', restaurante.id)
      .in('id', idsProdutos);

    if (errProdutos || !produtosBanco || produtosBanco.length !== idsProdutos.length) {
      await registrarLogWebhook({
        supabase,
        idCorrelacao,
        etapa: etapaAtual,
        nivel: 'erro',
        mensagem: 'Falha na recuperação de preços para conciliação do pedido.',
        restauranteId: restaurante.id,
        paymentId,
        erro: errProdutos,
      });
      return NextResponse.json({ error: 'Falha ao recuperar preços vigentes.' }, { status: 400 });
    }

    const produtos = produtosBanco as ItemCardapioPrecificado[];
    const produtoPorId = new Map(produtos.map((item) => [item.id, item]));

    etapaAtual = 'busca_complementos_itens';
    const idsComplementos = Array.from(new Set(itens.flatMap((item) => item.complementoIds ?? [])));
    let complementosBanco: ComplementoPrecificado[] = [];
    if (idsComplementos.length > 0) {
      const { data: complementosData, error: errComplementos } = await supabase
        .from('complementos_produto')
        .select('id, item_cardapio_id, nome, preco_adicional, disponivel')
        .in('id', idsComplementos);

      if (errComplementos) {
        await registrarLogWebhook({
          supabase,
          idCorrelacao,
          etapa: etapaAtual,
          nivel: 'erro',
          mensagem: 'Falha na recuperação de adicionais para conciliação do pedido.',
          restauranteId: restaurante.id,
          paymentId,
          erro: errComplementos,
        });
        return NextResponse.json({ error: 'Falha ao recuperar adicionais vigentes.' }, { status: 400 });
      }
      complementosBanco = (complementosData ?? []) as ComplementoPrecificado[];
    }
    const complementoPorId = new Map(complementosBanco.map((c) => [c.id, c]));

    const itensPrecificados = itens.map((item) => {
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
        precoUnitario: precoBase + precoAdicionais,
        adicionais: adicionaisValidos,
      };
    });

    const valorTotal = itensPrecificados.reduce((acc, item) => acc + item.precoUnitario * item.quantidade, 0);

    etapaAtual = 'geolocalizacao_distancia_fallback';
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

        const enderecoClienteTexto = dadosCliente.endereco
          ? montarEnderecoParaGeocodificacao(dadosCliente.endereco)
          : '';
        const destinoCliente = enderecoClienteTexto ? await geocodificarEndereco(enderecoClienteTexto) : null;

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
        console.error('Falha ao calcular geolocalização/distância no fallback do webhook (seguindo sem estimativa):', error);
      }
    }

    etapaAtual = 'tempo_preparo_fallback';
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

    etapaAtual = 'criacao_pedido_fallback';
    const externalReference = pagamento.external_reference || metadata.externalReference || `legacy-${restaurante.id}-${randomUUID()}`;
    const formaPagamento = String(
      pagamento.payment_method_id || metadata.metodoPagamento || metadata.metodo_pagamento || 'CARTAO'
    ).toUpperCase() === 'PIX'
      ? 'PIX'
      : 'CARTAO';

    const pedidoCriado = await criarPedidoPendente({
      restauranteId: restaurante.id,
      formaPagamento,
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

    const resultado = await atualizarStatusPedidoComNotificacoes({
      pedidoId: pedidoCriado.id,
      novoStatus: 'PAGO',
      mercadoPagoPaymentId: paymentId,
    });

    await registrarLogWebhook({
      supabase,
      idCorrelacao,
      etapa: 'finalizacao_conciliacao_fallback',
      nivel: 'sucesso',
      mensagem: 'Pedido legado conciliado com sucesso via fallback do webhook.',
      restauranteId: restaurante.id,
      paymentId,
      dados: {
        pedido_id: pedidoCriado.id,
        tracking_token: resultado.pedido.codigo_acompanhamento,
      },
    });

    return NextResponse.json({ received: true, pedido_id: pedidoCriado.id });
  } catch (error: unknown) {
    await registrarLogWebhook({
      supabase,
      idCorrelacao,
      etapa: etapaAtual,
      nivel: 'erro',
      mensagem: 'Erro interno durante processamento do webhook Mercado Pago.',
      erro: error,
    });

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
