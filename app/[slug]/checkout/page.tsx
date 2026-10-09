'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCarrinho, type AvaliacaoItemCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import PainelPix from '@/components/ecommerce/checkout/PainelPix';
import TelaPagamentoConfirmado from '@/components/ecommerce/checkout/TelaPagamentoConfirmado';
import { formatarTelefone, nomeValido, somenteDigitosTelefone, telefoneValido } from '@/utils/telefone';
import AbasEntrega from '@/components/ecommerce/checkout/AbasEntrega';
import BotaoLocalizacaoGps from '@/components/ecommerce/checkout/BotaoLocalizacaoGps';
import CampoCepEntrega from '@/components/ecommerce/checkout/CampoCepEntrega';
import CartaoRetirada from '@/components/ecommerce/checkout/CartaoRetirada';
import PagamentoCartaoBrick, { type DadosCartaoBrick } from '@/components/ecommerce/checkout/PagamentoCartaoBrick';
import FormularioEnderecoEntrega from '@/components/ecommerce/checkout/FormularioEnderecoEntrega';
import SeletorBairroEntrega from '@/components/ecommerce/checkout/SeletorBairroEntrega';
import { SeletorLocalizacaoMapa, type ResultadoLocalizacaoMapa } from '@/components/shared/SeletorLocalizacaoMapa';
import type { AbaEntregaCheckout, EtapaCheckout } from '@/components/ecommerce/checkout/tipos';
import { trackAddPaymentInfo, trackInitiateCheckout, trackClicouPagarPix, lerIdentificadoresMeta } from '@/utils/meta-pixel';
import { registrarCheckoutIniciadoFunil } from '@/actions/metricasFunil';
import {
  calcularTaxaEntrega,
  faixaTaxasEntrega,
  lojaTemTaxaPorBairro,
  obterConfigLojaEspecial,
  sugerirZonaEntrega,
} from '@/utils/config-lojas-especiais';
import { formatarCep, somenteDigitosCep } from '@/utils/cep';
import { formatarNumeroPedido } from '@/utils/pedido-status';
import {
  FORMAS_PAGAMENTO_PADRAO,
  aceitaCartao,
  aceitaCartaoCredito,
  aceitaCartaoDebito,
  aceitaPix,
  normalizarFormasPagamento,
  rotuloBotaoCartao,
  type FormaPagamentoLoja,
} from '@/utils/formas-pagamento';

interface RascunhoCheckout {
  telefone?: string;
  nome?: string;
  aba?: AbaEntregaCheckout;
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidadeCep?: string;
  observacoes?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface PixAtivoSalvo {
  codigo: string;
  tracking_url: string;
  pedido_id: string;
}

function lerJsonLocal<T>(chave: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

function gravarJsonLocal(chave: string, valor: unknown) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // armazenamento indisponível (aba anônima, cheio): o checkout segue funcionando sem rascunho
  }
}

function removerLocal(chave: string) {
  try {
    window.localStorage.removeItem(chave);
  } catch {
    // ignora
  }
}

const ETAPAS_CHECKOUT: EtapaCheckout[] = ['SACOLA', 'ENTREGA', 'PAGAMENTO'];

/** A etapa fica na entrada do histórico do navegador: reload e "voltar" retomam de onde parou. */
function etapaSalvaNoHistorico(): EtapaCheckout {
  if (typeof window === 'undefined') return 'SACOLA';
  const salva = (window.history.state as { etapaCheckout?: EtapaCheckout } | null)?.etapaCheckout;
  return salva && ETAPAS_CHECKOUT.includes(salva) ? salva : 'SACOLA';
}

export default function TelaDeCheckoutDedicada() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || '';

  const configLoja = useMemo(() => obterConfigLojaEspecial(slug), [slug]);

  const { itens, adicionarItem, removerItem, removerLinha, valorTotal, totalItens, limparCarrinho, avisosCarrinho, aplicarAvaliacao } = useCarrinho();

  // Rascunho do checkout (dados do cliente e endereço) e PIX em aberto: sobrevivem a reload e a voltar do navegador.
  // Dados de cartão NUNCA são guardados.
  const chaveRascunho = `checkout-rascunho:${slug}`;
  const chavePixAtivo = `checkout-pix-ativo:${slug}`;
  const [rascunho] = useState<RascunhoCheckout | null>(() => lerJsonLocal<RascunhoCheckout>(chaveRascunho));

  const [etapaCheckout, setEtapaCheckout] = useState<EtapaCheckout>(() => etapaSalvaNoHistorico());

  const [abaEntregaAtiva, setAbaEntregaAtiva] = useState<AbaEntregaCheckout>(rascunho?.aba ?? 'CEP');
  const [cep, setCep] = useState(rascunho?.cep ?? '');
  const [rua, setRua] = useState(rascunho?.rua ?? '');
  const [numero, setNumero] = useState(rascunho?.numero ?? '');
  const [bairro, setBairro] = useState(rascunho?.bairro ?? '');
  // bairro devolvido pelo mapa/cadastro que não bate com a lista de localidades atendidas
  const [bairroDetectado, setBairroDetectado] = useState('');
  // consulta de endereço pelo CEP
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [mensagemCep, setMensagemCep] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [cidadeCep, setCidadeCep] = useState(rascunho?.cidadeCep ?? '');
  const ultimoCepConsultadoRef = useRef('');
  // formas de pagamento habilitadas pelo gestor (até carregar, só PIX — o padrão de toda loja)
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamentoLoja[]>(FORMAS_PAGAMENTO_PADRAO);
  // Idempotência do checkout: um UUID por tentativa (duplo clique/retry reusam o mesmo; o servidor deduplica).
  const checkoutIdRef = useRef<string | null>(null);
  const enviandoCheckoutRef = useRef(false);
  const obterCheckoutId = () => {
    if (!checkoutIdRef.current) {
      checkoutIdRef.current = crypto.randomUUID();
    }
    return checkoutIdRef.current;
  };
  const pedidoRecusadoRef = useRef<{ codigo: string; assinatura: string } | null>(null);
  const [mpPublicKey, setMpPublicKey] = useState<string | null>(null);
  const [cartaoEmbutidoAberto, setCartaoEmbutidoAberto] = useState(false);
  const [nomeCliente, setNomeCliente] = useState(rascunho?.nome ?? '');
  const [contatoTocado, setContatoTocado] = useState({ telefone: false, nome: false });
  const [telefoneCliente, setTelefoneCliente] = useState(rascunho?.telefone ?? '');
  const [emailCliente, setEmailCliente] = useState('');
  const [observacoesCliente, setObservacoesCliente] = useState(rascunho?.observacoes ?? '');
  const [carregandoPagamento, setCarregandoPagamento] = useState(false);
  const [dadosPix, setDadosPix] = useState<{ qr_code: string; qr_code_base64?: string; payment_id: string; expira_em: string | null } | null>(null);
  const [erroPagamento, setErroPagamento] = useState('');
  const [lojaFechada, setLojaFechada] = useState(false);
  const [conferindoSacola, setConferindoSacola] = useState(false);
  const [gerandoNovoPix, setGerandoNovoPix] = useState(false);
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState<{ numero: string | null; valor: number } | null>(null);
  const [urlCheckoutCartao, setUrlCheckoutCartao] = useState<string | null>(null);
  const [trackingPedido, setTrackingPedido] = useState<{
    tracking_url: string;
    codigo_acompanhamento: string;
    pedido_id: string;
    estimativaMin: number | null;
    valor_total?: number;
  } | null>(null);
  const [enderecoLoja, setEnderecoLoja] = useState('Endereço do estabelecimento');
  const [latitudeLoja, setLatitudeLoja] = useState<number | null>(null);
  const [longitudeLoja, setLongitudeLoja] = useState<number | null>(null);

  const [entregaIfood, setEntregaIfood] = useState(false);
  const [respostaCotacaoIfood, setRespostaCotacaoIfood] = useState<{
    chave: string | null;
    estado: 'aguardando' | 'carregando' | 'ok' | 'indisponivel';
    taxa: number;
    tempoMinimoMin: number | null;
    tempoMaximoMin: number | null;
  }>({ chave: null, estado: 'aguardando', taxa: 0, tempoMinimoMin: null, tempoMaximoMin: null });
  const [clienteLatitude, setClienteLatitude] = useState<number | null>(rascunho?.latitude ?? null);
  const [clienteLongitude, setClienteLongitude] = useState<number | null>(rascunho?.longitude ?? null);
  const [modalMapaCepAberto, setModalMapaCepAberto] = useState(false);
  const [resultadoMapaCepPendente, setResultadoMapaCepPendente] = useState<ResultadoLocalizacaoMapa | null>(null);

  // Taxa de entrega: mesma regra usada pela API (utils/config-lojas-especiais).
  // Lojas com tabela por bairro só calculam depois que o cliente escolhe um bairro da lista.
  // Lojas com "Entregas pelo iFood": a taxa é a cotação do iFood pelo endereço; a tabela da
  // loja só volta a valer se o iFood não atender (cotacaoIfood.estado === 'indisponivel').
  const tipoEntregaAtual = abaEntregaAtiva === 'RETIRADA' ? 'RETIRADA' : 'ENTREGA';
  const enderecoEntregaPreenchido =
    (rua.trim().length > 0 && numero.trim().length > 0) || (clienteLatitude !== null && clienteLongitude !== null);
  // a cotação vale para o endereço em que foi feita; mudou o endereço, volta a "carregando"
  const chaveCotacaoIfood =
    entregaIfood && tipoEntregaAtual === 'ENTREGA' && enderecoEntregaPreenchido
      ? clienteLatitude !== null && clienteLongitude !== null
        ? `${clienteLatitude},${clienteLongitude}`
        : [rua.trim(), numero.trim(), bairro.trim(), cep].join('|')
      : null;
  const cotacaoIfood =
    chaveCotacaoIfood !== null && respostaCotacaoIfood.chave === chaveCotacaoIfood
      ? respostaCotacaoIfood
      : { chave: chaveCotacaoIfood, estado: chaveCotacaoIfood ? ('carregando' as const) : ('aguardando' as const), taxa: 0, tempoMinimoMin: null, tempoMaximoMin: null };
  const usaIfood = entregaIfood && tipoEntregaAtual === 'ENTREGA' && cotacaoIfood.estado !== 'indisponivel';
  const taxaPeloIfood = usaIfood && cotacaoIfood.estado === 'ok';
  const usaTaxaPorBairro = lojaTemTaxaPorBairro(configLoja) && !usaIfood;
  const calculoTaxa = calcularTaxaEntrega(configLoja, tipoEntregaAtual, bairro);
  const taxaEntrega = taxaPeloIfood ? cotacaoIfood.taxa : usaIfood ? 0 : calculoTaxa.ok ? calculoTaxa.taxa : 0;
  const zonaEntregaAtual = !usaIfood && calculoTaxa.ok ? calculoTaxa.zona : null;
  const faixaTaxas = faixaTaxasEntrega(configLoja);
  const bairroPendente = usaTaxaPorBairro && tipoEntregaAtual === 'ENTREGA' && !calculoTaxa.ok;
  const valorTotalComTaxa = valorTotal + taxaEntrega;

  // em lojas com taxa por bairro a entrega exige bairro da lista + endereço (ou ponto no mapa);
  // com iFood, exige endereço e a taxa já cotada (o cliente nunca paga um valor que não viu)
  const entregaValida = usaIfood
    ? taxaPeloIfood && enderecoEntregaPreenchido
    : !usaTaxaPorBairro || tipoEntregaAtual === 'RETIRADA' || (calculoTaxa.ok && enderecoEntregaPreenchido);

  // aplica um bairro vindo do mapa/cadastro; em lojas com tabela só vale se bater com a lista
  const aplicarBairroSugerido = (valor: string) => {
    if (!usaTaxaPorBairro) {
      setBairro(valor);
      return;
    }
    const zona = sugerirZonaEntrega(configLoja, valor);
    setBairro(zona?.nome ?? '');
    setBairroDetectado(zona ? '' : valor);
  };

  useEffect(() => {
    let ativo = true;

    const carregarResumoRestaurante = async () => {
      try {
        const resposta = await fetch(`/api/restaurantes/${slug}/resumo`, { cache: 'no-store' });
        if (!resposta.ok) return;
        const body = await resposta.json();
        if (!ativo) return;
        if (typeof body?.endereco === 'string' && body.endereco.trim()) {
          setEnderecoLoja(body.endereco);
        }
        if (typeof body?.latitude === 'number' && typeof body?.longitude === 'number') {
          setLatitudeLoja(body.latitude);
          setLongitudeLoja(body.longitude);
        }
        setFormasPagamento(normalizarFormasPagamento(body?.formas_pagamento_aceitas));
        setMpPublicKey(typeof body?.mp_public_key === 'string' && body.mp_public_key ? body.mp_public_key : null);
        setEntregaIfood(body?.entrega_ifood === true);
      } catch (error) {
        console.error('Erro ao carregar endereço da loja:', error);
      }
    };

    if (slug) {
      void carregarResumoRestaurante();
    }

    return () => {
      ativo = false;
    };
  }, [slug]);

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const telefoneOk = telefoneValido(telefoneCliente);
  const nomeOk = nomeValido(nomeCliente);
  const dadosContatoPreenchidos = telefoneOk && nomeOk;
  const erroTelefone = contatoTocado.telefone && !telefoneOk ? 'Informe o WhatsApp com DDD, ex.: (11) 99999-9999.' : '';
  const erroNome = contatoTocado.nome && !nomeOk ? 'Informe seu nome para o pedido.' : '';
  const sacolaTemBloqueio = avisosCarrinho.some((aviso) => aviso.tipo === 'bloqueio');

  // Etapa efetiva: recarregar na etapa 3 só vale se os dados da etapa 2 ainda estiverem válidos.
  const etapaEfetiva: EtapaCheckout =
    etapaCheckout === 'PAGAMENTO' && !dadosPix && (!dadosContatoPreenchidos || !entregaValida || itens.length === 0)
      ? itens.length === 0
        ? 'SACOLA'
        : 'ENTREGA'
      : etapaCheckout;
  const modoPix = Boolean(dadosPix);


  const dadosEndereco = useMemo(
    () => ({
      rua,
      numero,
      bairro,
      cidade: cidadeCep || configLoja.cidadeEntrega || 'Cidade',
      cep,
    }),
    [bairro, cep, cidadeCep, configLoja.cidadeEntrega, numero, rua]
  );

  // Lojas com "Entregas pelo iFood": cota a entrega quando o endereço (ou o
  // ponto no mapa) estiver preenchido. Só exibição — o servidor cota de novo
  // ao cobrar (POST /api/checkout).
  useEffect(() => {
    if (chaveCotacaoIfood === null) return;
    let ativo = true;
    const espera = setTimeout(async () => {
      try {
        const resposta = await fetch(`/api/restaurantes/${slug}/entrega-ifood`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            clienteLatitude !== null && clienteLongitude !== null
              ? { latitude: clienteLatitude, longitude: clienteLongitude }
              : { endereco: dadosEndereco }
          ),
        });
        const corpo = (await resposta.json().catch(() => ({}))) as {
          disponivel?: boolean;
          taxa?: number;
          tempoMinimoMin?: number;
          tempoMaximoMin?: number;
        };
        if (!ativo) return;
        setRespostaCotacaoIfood(
          corpo.disponivel && typeof corpo.taxa === 'number'
            ? { chave: chaveCotacaoIfood, estado: 'ok', taxa: corpo.taxa, tempoMinimoMin: corpo.tempoMinimoMin ?? null, tempoMaximoMin: corpo.tempoMaximoMin ?? null }
            : { chave: chaveCotacaoIfood, estado: 'indisponivel', taxa: 0, tempoMinimoMin: null, tempoMaximoMin: null }
        );
      } catch {
        if (ativo) setRespostaCotacaoIfood({ chave: chaveCotacaoIfood, estado: 'indisponivel', taxa: 0, tempoMinimoMin: null, tempoMaximoMin: null });
      }
    }, 700);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [chaveCotacaoIfood, clienteLatitude, clienteLongitude, dadosEndereco, slug]);

  const irParaEtapa = (nova: EtapaCheckout) => {
    setEtapaCheckout(nova);
    try {
      window.history.pushState({ etapaCheckout: nova }, '');
    } catch {
      // sem histórico: a etapa continua mudando só no estado
    }
  };

  // A etapa fica gravada no histórico do navegador (reload e "voltar" retomam de onde parou).
  useEffect(() => {
    try {
      const estado = window.history.state as { etapaCheckout?: EtapaCheckout } | null;
      if (!estado?.etapaCheckout) {
        window.history.replaceState({ ...(estado ?? {}), etapaCheckout: 'SACOLA' }, '');
      }
    } catch {
      // ignora
    }
    const aoVoltar = (evento: PopStateEvent) => {
      const salva = (evento.state as { etapaCheckout?: EtapaCheckout } | null)?.etapaCheckout;
      setEtapaCheckout(salva && ETAPAS_CHECKOUT.includes(salva) ? salva : 'SACOLA');
    };
    window.addEventListener('popstate', aoVoltar);
    return () => window.removeEventListener('popstate', aoVoltar);
  }, []);

  // Rascunho: telefone, nome, endereço e observação ficam salvos neste aparelho (nunca dados de cartão).
  useEffect(() => {
    gravarJsonLocal(chaveRascunho, {
      telefone: telefoneCliente,
      nome: nomeCliente,
      aba: abaEntregaAtiva,
      cep,
      rua,
      numero,
      bairro,
      cidadeCep,
      observacoes: observacoesCliente,
      latitude: clienteLatitude,
      longitude: clienteLongitude,
    } satisfies RascunhoCheckout);
  }, [chaveRascunho, telefoneCliente, nomeCliente, abaEntregaAtiva, cep, rua, numero, bairro, cidadeCep, observacoesCliente, clienteLatitude, clienteLongitude]);

  const itensParaConferir = () =>
    itens.map((item) => ({
      idUnico: item.idUnico,
      item_cardapio_id: item.produto.id,
      quantidade: item.quantidade,
      complementoIds: item.adicionaisEscolhidos.map((adicional) => adicional.id),
      adicionaisVistos: item.adicionaisEscolhidos.map((adicional) => ({ id: adicional.id, nome: adicional.nome })),
      precoVisto: Number(item.produto.preco_venda),
    }));

  // Confere a sacola com o cardápio de agora (preço, disponibilidade, loja aberta). Não bloqueia por falha de rede:
  // o servidor confere de novo ao cobrar.
  const conferirSacola = async (): Promise<'ok' | 'revisar' | 'fechada'> => {
    if (itens.length === 0) return 'ok';
    setConferindoSacola(true);
    try {
      const resposta = await fetch('/api/checkout/validar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, itens: itensParaConferir() }),
      });
      const body = await resposta.json().catch(() => null);
      if (!resposta.ok || !body) return 'ok';
      const avaliacoes = (body.itens ?? []) as AvaliacaoItemCarrinho[];
      aplicarAvaliacao(avaliacoes);
      setLojaFechada(body.aberta === false);
      if (body.aberta === false) return 'fechada';
      const precisaRevisar = avaliacoes.some((a) => ['preco_alterado', 'indisponivel', 'adicional_indisponivel'].includes(a.status));
      return precisaRevisar ? 'revisar' : 'ok';
    } catch {
      return 'ok';
    } finally {
      setConferindoSacola(false);
    }
  };

  // Ao abrir o checkout: preços/itens que mudaram desde que a sacola foi montada aparecem já na primeira tela.
  useEffect(() => {
    if (itens.length === 0 || dadosPix) return;
    const inicio = window.setTimeout(() => void conferirSacola(), 0);
    return () => window.clearTimeout(inicio);
    // só na abertura da tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload com PIX em aberto: recupera o QR do pedido (o Mercado Pago guarda o código) em vez de perdê-lo.
  useEffect(() => {
    const salvo = lerJsonLocal<PixAtivoSalvo>(chavePixAtivo);
    if (!salvo) return;
    let ativo = true;
    const recuperar = async () => {
      try {
        const resposta = await fetch(
          `/api/checkout/pix-pendente?slug=${encodeURIComponent(slug)}&codigo=${encodeURIComponent(salvo.codigo)}`,
          { cache: 'no-store' }
        );
        const body = await resposta.json().catch(() => null);
        if (!ativo || !body) return;
        const pedidoRecuperado = {
          tracking_url: salvo.tracking_url,
          codigo_acompanhamento: salvo.codigo,
          pedido_id: salvo.pedido_id,
          estimativaMin: null,
          valor_total: typeof body.valor_total === 'number' ? body.valor_total : undefined,
        };
        if (body.pix?.qr_code) {
          setTrackingPedido(pedidoRecuperado);
          setDadosPix({
            qr_code: body.pix.qr_code,
            qr_code_base64: body.pix.qr_code_base64,
            payment_id: body.pix.payment_id,
            expira_em: body.pix.expira_em ?? null,
          });
          return;
        }
        if (body.status === 'PENDENTE') {
          // PIX expirado: mostra o painel de "gerar novo PIX" para o mesmo pedido
          setTrackingPedido(pedidoRecuperado);
          setDadosPix({ qr_code: '', payment_id: '', expira_em: new Date(Date.now() - 1000).toISOString() });
          return;
        }
        removerLocal(chavePixAtivo);
        if (body.status && body.status !== 'CANCELADO') {
          router.replace(`${salvo.tracking_url}?pagamento=aprovado`);
        }
      } catch {
        // sem rede: o cliente ainda pode abrir o acompanhamento pelo histórico
      }
    };
    void recuperar();
    return () => {
      ativo = false;
    };
  }, [chavePixAtivo, router, slug]);

  // PIX em aberto: consulta o status a cada 4 s (e na hora em que a aba volta ao primeiro plano).
  useEffect(() => {
    const codigo = trackingPedido?.codigo_acompanhamento;
    if (!codigo || !dadosPix || pagamentoConfirmado) return;
    let ativo = true;
    const consultar = async () => {
      try {
        const resposta = await fetch(`/api/pedidos/acompanhar/${encodeURIComponent(codigo)}?slug=${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        });
        if (!resposta.ok || !ativo) return;
        const pedido = await resposta.json();
        if (!ativo) return;
        if (pedido.status === 'CANCELADO') {
          removerLocal(chavePixAtivo);
          setDadosPix(null);
          setErroPagamento('A loja cancelou este pedido. Faça um novo pedido pelo cardápio.');
          return;
        }
        if (pedido.status && pedido.status !== 'PENDENTE') {
          removerLocal(chavePixAtivo);
          try {
            navigator.vibrate?.([150, 80, 150]);
          } catch {
            // sem vibração neste aparelho
          }
          setPagamentoConfirmado({
            numero: formatarNumeroPedido(pedido.numero_pedido, codigo),
            valor: Number(pedido.valor_total),
          });
        }
      } catch {
        // tenta de novo no próximo ciclo
      }
    };
    const intervalo = window.setInterval(() => void consultar(), 4000);
    const aoVoltarParaAba = () => {
      if (document.visibilityState === 'visible') void consultar();
    };
    document.addEventListener('visibilitychange', aoVoltarParaAba);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltarParaAba);
    };
  }, [trackingPedido?.codigo_acompanhamento, dadosPix, pagamentoConfirmado, slug, chavePixAtivo]);

  // Pagamento confirmado: mostra a confirmação e leva ao acompanhamento sozinho.
  useEffect(() => {
    if (!pagamentoConfirmado || !trackingPedido) return;
    const espera = window.setTimeout(() => {
      router.push(`${trackingPedido.tracking_url}?pagamento=aprovado`);
    }, 4000);
    return () => window.clearTimeout(espera);
  }, [pagamentoConfirmado, trackingPedido, router]);

  const handleVoltarClique = () => {
    if (modoPix || etapaEfetiva === 'SACOLA') {
      router.push(`/${slug}`);
      return;
    }
    const anterior: EtapaCheckout = etapaEfetiva === 'PAGAMENTO' ? 'ENTREGA' : 'SACOLA';
    setEtapaCheckout(anterior);
    try {
      window.history.replaceState({ ...(window.history.state ?? {}), etapaCheckout: anterior }, '');
    } catch {
      // ignora
    }
  };

  const handleAcaoPrincipal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (etapaEfetiva === 'SACOLA') {
      if (itens.length === 0 || conferindoSacola) return;
      const resultado = await conferirSacola();
      if (resultado !== 'ok') return;
      trackInitiateCheckout({
        itens: itens.map((item) => ({ id: item.produto.id, quantidade: item.quantidade })),
        valorTotal,
      });
      void registrarCheckoutIniciadoFunil(slug);
      irParaEtapa('ENTREGA');
    } else if (etapaEfetiva === 'ENTREGA') {
      setContatoTocado({ telefone: true, nome: true });
      if (!dadosContatoPreenchidos || !entregaValida) return;
      setErroPagamento('');
      irParaEtapa('PAGAMENTO');
    }
  };

  const montarCorpoPedido = (novoMetodo: 'PIX' | 'CARTAO', cartao?: DadosCartaoBrick) => ({
    slug,
    checkoutId: obterCheckoutId(),
    paymentMethod: novoMetodo,
    ...(cartao ? { cartao } : {}),
    valorTotalExibido: valorTotalComTaxa,
    itens: itensParaConferir(),
    dadosCliente: {
      nome: nomeCliente.trim(),
      telefone: somenteDigitosTelefone(telefoneCliente),
      email: emailCliente,
      observacoes: observacoesCliente.trim() || undefined,
      tipoEntrega: abaEntregaAtiva === 'RETIRADA' ? 'RETIRADA' : 'ENTREGA',
      endereco: abaEntregaAtiva === 'RETIRADA' ? undefined : dadosEndereco,
    },
    clienteLatitude: abaEntregaAtiva === 'RETIRADA' ? null : clienteLatitude,
    clienteLongitude: abaEntregaAtiva === 'RETIRADA' ? null : clienteLongitude,
    ...lerIdentificadoresMeta(),
  });

  // Respostas 409 do servidor que pedem uma ação do cliente (preço mudou, item saiu, loja fechou, total mudou).
  // Devolve a mensagem para mostrar, ou null se não for um desses casos.
  const tratarConflitoCheckout = (body: Record<string, unknown> | null): string | null => {
    const codigo = body?.codigo;
    const mensagem = typeof body?.error === 'string' ? body.error : 'Confira os dados e tente novamente.';
    if (codigo === 'CARRINHO_DESATUALIZADO') {
      aplicarAvaliacao((body?.itens ?? []) as AvaliacaoItemCarrinho[]);
      setEtapaCheckout('SACOLA');
      return mensagem;
    }
    if (codigo === 'LOJA_FECHADA') {
      setLojaFechada(true);
      return mensagem;
    }
    if (codigo === 'VALOR_DIVERGENTE') {
      setEtapaCheckout('ENTREGA');
      return mensagem;
    }
    return null;
  };

  // Pagamento com o formulário de cartão embutido: o servidor cria o pedido e cobra com o token do cartão.
  // Lança erro (mensagem amigável) se o pagamento não for concluído, o que libera o formulário para nova tentativa.
  const pagarComCartaoEmbutido = async (dadosCartao: DadosCartaoBrick) => {
    trackAddPaymentInfo({
      metodo: 'cartao',
      valorTotal: valorTotalComTaxa,
      itens: itens.map((item) => ({ id: item.produto.id, quantidade: item.quantidade })),
    });
    const corpoPedido = montarCorpoPedido('CARTAO', dadosCartao);
    const assinatura = JSON.stringify([corpoPedido.itens, corpoPedido.dadosCliente, valorTotalComTaxa]);
    const retentativa = pedidoRecusadoRef.current;
    // Depois de uma recusa, as próximas tentativas (outro cartão) reaproveitam o MESMO pedido,
    // em vez de criar um pedido novo a cada tentativa. Se a sacola/dados mudaram, cria um novo.
    const reaproveitar = retentativa && retentativa.assinatura === assinatura ? retentativa.codigo : null;

    if (enviandoCheckoutRef.current) {
      throw new Error('Pagamento em processamento. Aguarde alguns instantes.');
    }
    enviandoCheckoutRef.current = true;
    let resposta: Response;
    try {
      resposta = await fetch(reaproveitar ? '/api/checkout/retomar' : '/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          reaproveitar
            ? { slug, codigoAcompanhamento: reaproveitar, paymentMethod: 'CARTAO', cartao: dadosCartao }
            : corpoPedido
        ),
      });
    } finally {
      enviandoCheckoutRef.current = false;
    }
    const body = await resposta.json().catch(() => null);
    if (resposta.status === 409 && body?.duplicado && body.tracking_url) {
      limparCarrinho();
      router.push(`${body.tracking_url}?pagamento=pendente`);
      return;
    }
    checkoutIdRef.current = null;
    const conflito = !resposta.ok ? tratarConflitoCheckout(body) : null;
    if (conflito) {
      setErroPagamento(conflito);
      throw new Error(conflito);
    }
    if (!resposta.ok || !body) {
      throw new Error(body?.error || 'Falha ao processar o pagamento. Tente novamente.');
    }
    if (body.status === 'rejected') {
      if (body.codigo_acompanhamento) {
        pedidoRecusadoRef.current = { codigo: String(body.codigo_acompanhamento), assinatura };
      }
      throw new Error(body.mensagem || 'O pagamento foi recusado. Tente outro cartão ou escolha PIX.');
    }
    pedidoRecusadoRef.current = null;

    // O evento Purchase NÃO é disparado aqui: pedido criado não é pedido pago. Ele sai da tela de
    // acompanhamento, quando o status confirma o pagamento (ver PainelAcompanhamentoPedido).
    limparCarrinho();
    router.push(body.status === 'approved' ? body.tracking_url : `${body.tracking_url}?pagamento=pendente`);
  };

  const criarPagamento = async (novoMetodo: 'PIX' | 'CARTAO') => {
    if (enviandoCheckoutRef.current || dadosPix) {
      return;
    }
    enviandoCheckoutRef.current = true;
    setCarregandoPagamento(true);
    setErroPagamento('');
    setDadosPix(null);
    setUrlCheckoutCartao(null);
    setTrackingPedido(null);

    try {
      const resposta = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(montarCorpoPedido(novoMetodo)),
      });

      const body = await resposta.json().catch(() => ({}));
      if (resposta.status === 409 && body?.duplicado && body.tracking_url) {
        limparCarrinho();
        router.push(`${body.tracking_url}?pagamento=pendente`);
        return;
      }
      checkoutIdRef.current = null;
      if (!resposta.ok) {
        const conflito = tratarConflitoCheckout(body);
        throw new Error(conflito ?? (body?.error || 'Falha ao iniciar pagamento.'));
      }

      if (body.tracking_url && body.codigo_acompanhamento && body.pedido_id) {
        const preparo = Number(body.tempo_preparo_estimado_min);
        const deslocamento = Number(body.tempo_deslocamento_min);
        const estimativaMin =
          Number.isFinite(preparo) && preparo > 0
            ? preparo + (Number.isFinite(deslocamento) && deslocamento > 0 ? deslocamento : 0)
            : null;

        setTrackingPedido({
          tracking_url: body.tracking_url,
          codigo_acompanhamento: body.codigo_acompanhamento,
          pedido_id: body.pedido_id,
          estimativaMin,
          valor_total: typeof body.valor_total === 'number' ? body.valor_total : valorTotalComTaxa,
        });
      }

      if (novoMetodo === 'PIX') {
        setDadosPix({
          qr_code: body.qr_code,
          qr_code_base64: body.qr_code_base64,
          payment_id: body.payment_id,
          expira_em: typeof body.expira_em === 'string' ? body.expira_em : null,
        });
        // Pedido criado: a sacola já virou pedido, então sai do carrinho agora (evita pagar/pedir duas vezes)
        // e o PIX fica "salvo" por código para sobreviver a reload.
        gravarJsonLocal(chavePixAtivo, {
          codigo: body.codigo_acompanhamento,
          tracking_url: body.tracking_url,
          pedido_id: body.pedido_id,
        } satisfies PixAtivoSalvo);
        limparCarrinho();
      } else if (body.checkout_url) {
        setUrlCheckoutCartao(body.checkout_url);
        limparCarrinho();
        window.location.href = body.checkout_url;
      }
    } catch (error) {
      console.error(error);
      setErroPagamento(error instanceof Error ? error.message : 'Falha ao iniciar pagamento.');
    } finally {
      enviandoCheckoutRef.current = false;
      setCarregandoPagamento(false);
    }
  };

  // PIX expirado: gera um novo código para o MESMO pedido (a rota /retomar cancela o anterior e confere se não foi pago).
  const gerarNovoPix = async () => {
    const codigo = trackingPedido?.codigo_acompanhamento;
    if (!codigo || gerandoNovoPix) return;
    setGerandoNovoPix(true);
    setErroPagamento('');
    try {
      const resposta = await fetch('/api/checkout/retomar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, codigoAcompanhamento: codigo, paymentMethod: 'PIX' }),
      });
      const body = await resposta.json().catch(() => null);
      if (resposta.status === 409 && body?.duplicado && body.tracking_url) {
        removerLocal(chavePixAtivo);
        router.push(`${body.tracking_url}?pagamento=aprovado`);
        return;
      }
      if (!resposta.ok || !body?.qr_code) {
        throw new Error(body?.error || 'Não foi possível gerar um novo PIX.');
      }
      setDadosPix({
        qr_code: body.qr_code,
        qr_code_base64: body.qr_code_base64,
        payment_id: String(body.payment_id ?? ''),
        expira_em: typeof body.expira_em === 'string' ? body.expira_em : null,
      });
    } catch (error) {
      setErroPagamento(error instanceof Error ? error.message : 'Não foi possível gerar um novo PIX.');
    } finally {
      setGerandoNovoPix(false);
    }
  };

  const handleBuscarClientePorTelefone = async () => {
    const digitos = telefoneCliente.replace(/\D/g, '');
    if (digitos.length < 10) return;

    try {
      const resposta = await fetch(`/api/restaurantes/${slug}/clientes?telefone=${encodeURIComponent(digitos)}`);
      const dados = await resposta.json();

      // cliente novo: nada a preencher (a localização é opcional, pelo botão "Abrir minha localização")
      if (!dados?.encontrado) return;

      if (!nomeCliente && dados.nome) setNomeCliente(dados.nome);
      if (!emailCliente && dados.email) setEmailCliente(dados.email);

      const endereco = dados.endereco as { rua?: string; numero?: string; bairro?: string; cep?: string } | null;
      if (endereco) {
        if (!rua && endereco.rua) setRua(endereco.rua);
        if (!numero && endereco.numero) setNumero(endereco.numero);
        if (!bairro && endereco.bairro) aplicarBairroSugerido(endereco.bairro);
        if (!cep && endereco.cep) setCep(endereco.cep);
      }
    } catch (error) {
      console.error('Erro ao buscar cadastro do cliente:', error);
    }
  };

  const buscarEnderecoPorCep = async (digitos: string) => {
    ultimoCepConsultadoRef.current = digitos;
    setBuscandoCep(true);
    setMensagemCep(null);

    try {
      const resposta = await fetch(`/api/cep?cep=${digitos}`);
      const body = await resposta.json().catch(() => null);
      // o cliente já digitou outro CEP enquanto esta resposta vinha: descarta
      if (ultimoCepConsultadoRef.current !== digitos) return;

      if (!resposta.ok || !body) {
        setMensagemCep({
          tipo: 'erro',
          texto:
            resposta.status === 404
              ? 'CEP não encontrado. Confira os números ou preencha o endereço abaixo.'
              : 'Não foi possível consultar o CEP agora. Preencha o endereço abaixo.',
        });
        return;
      }

      if (typeof body.rua === 'string' && body.rua) setRua(body.rua);
      if (typeof body.bairro === 'string' && body.bairro) aplicarBairroSugerido(body.bairro);
      if (typeof body.cidade === 'string' && body.cidade) {
        setCidadeCep(typeof body.uf === 'string' && body.uf ? `${body.cidade} - ${body.uf}` : body.cidade);
      }

      const resumo = [body.rua, body.bairro, body.cidade].filter((parte) => typeof parte === 'string' && parte).join(' · ');
      setMensagemCep({ tipo: 'ok', texto: resumo ? `Endereço encontrado: ${resumo}` : 'CEP encontrado. Complete o endereço abaixo.' });

      // próximo campo a preencher é o número
      setTimeout(() => document.getElementById('input-numero')?.focus(), 50);
    } catch (error) {
      console.error('Erro ao consultar CEP:', error);
      if (ultimoCepConsultadoRef.current !== digitos) return;
      setMensagemCep({ tipo: 'erro', texto: 'Não foi possível consultar o CEP agora. Preencha o endereço abaixo.' });
    } finally {
      if (ultimoCepConsultadoRef.current === digitos) setBuscandoCep(false);
    }
  };

  const handleAlterarCep = (valor: string) => {
    setCep(formatarCep(valor));
    const digitos = somenteDigitosCep(valor);

    if (digitos.length < 8) {
      // CEP incompleto: cancela qualquer consulta em andamento e limpa o aviso
      ultimoCepConsultadoRef.current = '';
      setBuscandoCep(false);
      setMensagemCep(null);
      return;
    }

    if (digitos !== ultimoCepConsultadoRef.current) {
      void buscarEnderecoPorCep(digitos);
    }
  };

  const handleLocalizacaoConfirmada = (resultado: ResultadoLocalizacaoMapa) => {
    setClienteLatitude(resultado.latitude);
    setClienteLongitude(resultado.longitude);

    if (resultado.endereco) {
      if (resultado.endereco.rua) setRua(resultado.endereco.rua);
      if (resultado.endereco.numero) setNumero(resultado.endereco.numero);
      if (resultado.endereco.bairro) aplicarBairroSugerido(resultado.endereco.bairro);
      if (resultado.endereco.cep) setCep(resultado.endereco.cep);
    }
  };

  const handleCapturaTemporariaMapaCep = (resultado: ResultadoLocalizacaoMapa) => {
    setResultadoMapaCepPendente(resultado);
  };

  const handleConfirmarMapaCep = () => {
    if (resultadoMapaCepPendente) {
      handleLocalizacaoConfirmada(resultadoMapaCepPendente);
    }
    setModalMapaCepAberto(false);
    setResultadoMapaCepPendente(null);
  };

  const handleCancelarMapaCep = () => {
    setModalMapaCepAberto(false);
    setResultadoMapaCepPendente(null);
  };

  // Etapas 1 e 3: h-dvh (altura visível de verdade no celular, descontando as barras do navegador).
  // A página em si não rola: só o miolo; cabeçalho e rodapé (total + botão) ficam sempre à vista.
  // Etapa 2 (dados de entrega) mantém a página rolando normalmente, por causa do teclado do celular.
  const layoutFixo = modoPix || etapaEfetiva !== 'ENTREGA';

  return (
    <main
      className={`w-full bg-[#F8F8F8] text-[#1A1A1A] font-sans antialiased flex flex-col selection:bg-zinc-900 selection:text-white ${
        layoutFixo ? 'h-dvh overflow-hidden' : 'min-h-screen justify-between'
      }`}
    >

      <div className={`w-full max-w-xl mx-auto bg-white flex-1 flex flex-col shadow-sm border-x border-zinc-200/40 ${layoutFixo ? 'min-h-0' : ''}`}>

        <header className={`p-4 sm:p-6 border-b border-zinc-100 flex items-center gap-4 bg-white shrink-0 ${layoutFixo ? '' : 'sticky top-0 z-10'}`}>
          <button
            type="button"
            onClick={handleVoltarClique}
            aria-label="Voltar"
            className="w-11 h-11 shrink-0 rounded-xl bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-zinc-800 transition-colors border border-zinc-200/40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-extrabold tracking-tight text-zinc-900">
              {modoPix
                ? 'Pague com PIX'
                : etapaEfetiva === 'SACOLA'
                  ? 'Revisar Sacola'
                  : etapaEfetiva === 'ENTREGA'
                    ? 'Finalizar Pedido'
                    : 'Pagamento'}
            </h1>
            {modoPix ? (
              <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Pedido criado • falta pagar</p>
            ) : (
              <ol className="mt-1 flex items-center gap-1.5" aria-label="Etapas do pedido">
                {(['SACOLA', 'ENTREGA', 'PAGAMENTO'] as EtapaCheckout[]).map((etapa, indice) => {
                  const posicaoAtual = ETAPAS_CHECKOUT.indexOf(etapaEfetiva);
                  const concluida = indice < posicaoAtual;
                  const atual = indice === posicaoAtual;
                  const nome = etapa === 'SACOLA' ? 'Sacola' : etapa === 'ENTREGA' ? 'Entrega' : 'Pagamento';
                  return (
                    <li key={etapa} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!concluida}
                        onClick={() => {
                          setEtapaCheckout(etapa);
                          try {
                            window.history.replaceState({ ...(window.history.state ?? {}), etapaCheckout: etapa }, '');
                          } catch {
                            // ignora
                          }
                        }}
                        aria-current={atual ? 'step' : undefined}
                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                          atual ? 'bg-zinc-900 text-white' : concluida ? 'bg-emerald-50 text-emerald-700 underline' : 'bg-zinc-100 text-zinc-400'
                        }`}
                      >
                        {indice + 1}. {nome}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </header>

        <div className={`p-4 sm:p-6 space-y-6 flex-1 bg-white ${layoutFixo ? 'min-h-0 overflow-y-auto overscroll-contain' : ''}`}>

          {modoPix && dadosPix && (
            <div className="space-y-4">
              <PainelPix
                valor={trackingPedido?.valor_total ?? valorTotalComTaxa}
                qrCode={dadosPix.qr_code}
                qrCodeBase64={dadosPix.qr_code_base64}
                expiraEm={dadosPix.expira_em}
                gerandoNovo={gerandoNovoPix}
                erro={erroPagamento}
                onGerarNovo={() => void gerarNovoPix()}
              />
              {trackingPedido ? (
                <Link
                  href={trackingPedido.tracking_url}
                  className="flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-200 px-4 text-xs font-bold uppercase tracking-wider text-zinc-700"
                >
                  Ver status do pedido
                </Link>
              ) : null}
              <p className="text-center text-[11px] text-zinc-400">Seu pedido só vai para a cozinha depois que o PIX for confirmado.</p>
            </div>
          )}
          {!modoPix && etapaEfetiva === 'SACOLA' && (
            <div className="space-y-4">
              {lojaFechada && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
                  A loja está fechada no momento. Você pode montar a sacola, mas só consegue finalizar no horário de funcionamento.
                </div>
              )}
              {avisosCarrinho.map((aviso) => (
                <div
                  key={`${aviso.idUnico}-${aviso.texto}`}
                  role={aviso.tipo === 'bloqueio' ? 'alert' : 'status'}
                  className={`rounded-2xl border p-4 text-xs font-semibold leading-relaxed ${
                    aviso.tipo === 'bloqueio'
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : aviso.tipo === 'atencao'
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  {aviso.texto}
                </div>
              ))}
              {erroPagamento && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
                  {erroPagamento}
                </div>
              )}
              {usaTaxaPorBairro && faixaTaxas && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                  <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M4.93 4.93l14.14 14.14M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs font-medium leading-relaxed">
                    A taxa de entrega depende do bairro ({formatarMoeda(faixaTaxas.minima)} a {formatarMoeda(faixaTaxas.maxima)}) e é calculada na
                    próxima etapa. Retirada no balcão não tem taxa.
                  </p>
                </div>
              )}
              {usaIfood && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                  <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M4.93 4.93l14.14 14.14M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs font-medium leading-relaxed">
                    A entrega é feita por um entregador iFood. A taxa é calculada pelo seu endereço na próxima etapa. Retirada no balcão não tem
                    taxa.
                  </p>
                </div>
              )}
              {!usaTaxaPorBairro && !usaIfood && taxaEntrega > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                  <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M4.93 4.93l14.14 14.14M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs font-medium leading-relaxed">
                    Esta loja trabalha apenas com entrega. Uma taxa fixa de {formatarMoeda(taxaEntrega)} será adicionada ao valor da sua sacola.
                  </p>
                </div>
              )}

              {itens.length === 0 ? (
                <div className="text-center py-20 text-zinc-400 italic text-xs font-medium bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 p-4">
                  Sua sacola está limpa. Adicione itens para prosseguir ao pagamento.
                  <Link href={`/${slug}`} className="block mt-4 text-xs font-extrabold uppercase tracking-wider text-zinc-900 underline">Voltar à Loja</Link>
                </div>
              ) : (
                itens.map((item) => (
                  <div
                    key={item.idUnico}
                    className="bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      {item.produto.imagem_url ? (
                        <Image
                          src={item.produto.imagem_url}
                          alt={item.produto.nome}
                          width={56}
                          height={56}
                          className="h-14 w-14 shrink-0 rounded-xl border border-zinc-200/60 object-cover shadow-inner"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-zinc-50 border border-zinc-200/60 flex items-center justify-center text-xs font-extrabold text-zinc-400 font-mono shrink-0 shadow-inner">
                          {item.produto.nome.substring(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-zinc-900 text-sm leading-tight">{item.produto.nome}</h4>
                        {item.adicionaisEscolhidos.length > 0 ? (
                          <p className="mt-0.5 text-[11px] text-zinc-500">+ {item.adicionaisEscolhidos.map((a) => a.nome).join(', ')}</p>
                        ) : null}
                        <span className="text-sm font-extrabold text-zinc-700 font-mono block mt-1">
                          {formatarMoeda(Number(item.produto.preco_venda) * item.quantidade)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => removerLinha(item.idUnico)}
                        className="min-h-11 rounded-lg px-2 text-xs font-bold text-red-600 underline underline-offset-2"
                      >
                        Remover
                      </button>
                      <div className="flex items-center bg-zinc-50 rounded-xl p-1 gap-1 border border-zinc-200/40 shrink-0 select-none">
                        <button
                          type="button"
                          aria-label={`Diminuir quantidade de ${item.produto.nome}`}
                          onClick={() => removerItem(item.idUnico)}
                          className="w-11 h-11 rounded-lg bg-white border border-zinc-200/40 flex items-center justify-center text-base font-extrabold text-zinc-600 hover:bg-zinc-100 shadow-sm transition-colors"
                        >
                          -
                        </button>
                        <span className="min-w-8 text-center text-sm font-extrabold text-zinc-900 font-mono" aria-live="polite">
                          {item.quantidade}
                        </span>
                        <button
                          type="button"
                          aria-label={`Aumentar quantidade de ${item.produto.nome}`}
                          onClick={() => adicionarItem(item.produto, item.adicionaisEscolhidos)}
                          className="w-11 h-11 rounded-lg bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-base font-extrabold text-white shadow-sm transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {itens.length > 0 && (
                <Link
                  href={`/${slug}`}
                  className="flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 text-xs font-bold uppercase tracking-wider text-zinc-600"
                >
                  + Adicionar mais itens
                </Link>
              )}
            </div>
          )}
          {!modoPix && etapaEfetiva === 'ENTREGA' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {erroPagamento && (
                <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-semibold text-amber-900">
                  {erroPagamento}
                </div>
              )}
              <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-4 flex justify-between items-center text-xs font-medium">
                <span className="text-zinc-500">Resumo da Compra</span>
                <span className="font-bold text-zinc-900">{totalItens} {totalItens === 1 ? 'item' : 'itens'} na sacola</span>
              </div>

              <div className="bg-white border border-zinc-200/60 rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">WhatsApp para Notificações</label>
                  <input
                    id="input-telefone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    required
                    autoFocus
                    placeholder="(11) 99999-9999"
                    value={telefoneCliente}
                    aria-invalid={erroTelefone ? true : undefined}
                    aria-describedby={erroTelefone ? 'erro-telefone' : undefined}
                    onChange={(e) => setTelefoneCliente(formatarTelefone(e.target.value))}
                    onBlur={() => {
                      setContatoTocado((atual) => ({ ...atual, telefone: true }));
                      void handleBuscarClientePorTelefone();
                    }}
                    className="w-full bg-zinc-50/50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:bg-white focus:border-zinc-400 transition-all text-zinc-900 placeholder-zinc-400"
                  />
                  {erroTelefone ? (
                    <p id="erro-telefone" role="alert" className="text-[11px] font-semibold text-red-600">
                      {erroTelefone}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Nome Completo</label>
                  <input
                    id="input-nome"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="Ex: João Silva"
                    value={nomeCliente}
                    aria-invalid={erroNome ? true : undefined}
                    aria-describedby={erroNome ? 'erro-nome' : undefined}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    onBlur={() => setContatoTocado((atual) => ({ ...atual, nome: true }))}
                    className="w-full bg-zinc-50/50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:bg-white focus:border-zinc-400 transition-all text-zinc-900 placeholder-zinc-400"
                  />
                  {erroNome ? (
                    <p id="erro-nome" role="alert" className="text-[11px] font-semibold text-red-600">
                      {erroNome}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="bg-white border border-zinc-200/60 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <AbasEntrega
                  abaAtiva={abaEntregaAtiva}
                  onChangeAba={setAbaEntregaAtiva}
                  classeCorTextoAtiva="text-zinc-900"
                  ocultarRetirada={configLoja.ocultarRetirada}
                />

                <div className="p-4 space-y-4">
                  {abaEntregaAtiva === 'CEP' && (
                    <div className="space-y-2">
                      <BotaoLocalizacaoGps
                        rotulo="Abrir minha localização"
                        onCapturarLocalizacao={() => setModalMapaCepAberto(true)}
                      />
                      {clienteLatitude !== null && clienteLongitude !== null && (
                        <p className="text-[11px] font-semibold text-emerald-700">
                          Localização marcada no mapa. O entregador receberá o ponto exato.
                        </p>
                      )}
                    </div>
                  )}

                  {abaEntregaAtiva === 'CEP' && (
                    <CampoCepEntrega
                      cep={cep}
                      onChangeCep={handleAlterarCep}
                      abaAtiva={abaEntregaAtiva}
                      buscando={buscandoCep}
                      mensagem={mensagemCep}
                    />
                  )}

                  {abaEntregaAtiva === 'GPS' && (
                    <div className="space-y-3">
                      <SeletorLocalizacaoMapa
                        latitudeInicial={clienteLatitude}
                        longitudeInicial={clienteLongitude}
                        onLocalizacaoConfirmada={handleLocalizacaoConfirmada}
                      />
                      {(rua || bairro) && (
                        <div className="rounded-xl bg-zinc-50 border border-zinc-200/60 px-3.5 py-2.5 text-xs text-zinc-600">
                          {[rua, numero, bairro].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {!usaIfood && configLoja.zonasEntrega && configLoja.zonasEntrega.length > 0 && (
                        <SeletorBairroEntrega
                          zonas={configLoja.zonasEntrega}
                          valor={bairro}
                          onChange={(valor) => {
                            setBairro(valor);
                            setBairroDetectado('');
                          }}
                          bairroDetectado={bairroDetectado}
                        />
                      )}
                    </div>
                  )}

                  {abaEntregaAtiva === 'RETIRADA' && !configLoja.ocultarRetirada && (
                    <CartaoRetirada endereco={enderecoLoja} latitude={latitudeLoja} longitude={longitudeLoja} />
                  )}

                  {abaEntregaAtiva === 'CEP' && usaTaxaPorBairro && (
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      Dica: em “Usar GPS” você marca o ponto exato no mapa e o motoboy chega direto na sua porta.
                    </p>
                  )}

                  {abaEntregaAtiva === 'CEP' && (
                    <FormularioEnderecoEntrega
                      rua={rua}
                      onChangeRua={setRua}
                      numero={numero}
                      onChangeNumero={setNumero}
                      bairro={bairro}
                      onChangeBairro={(valor) => {
                        setBairro(valor);
                        setBairroDetectado('');
                      }}
                      zonasEntrega={usaIfood ? undefined : configLoja.zonasEntrega}
                      bairroDetectado={bairroDetectado}
                    />
                  )}

                  {entregaIfood && tipoEntregaAtual === 'ENTREGA' && (
                    <p
                      className={`text-[11px] font-semibold leading-relaxed ${
                        cotacaoIfood.estado === 'ok' ? 'text-emerald-700' : cotacaoIfood.estado === 'indisponivel' ? 'text-zinc-500' : 'text-amber-700'
                      }`}
                    >
                      {cotacaoIfood.estado === 'ok'
                        ? `Entrega pelo iFood: ${formatarMoeda(cotacaoIfood.taxa)}${
                            cotacaoIfood.tempoMinimoMin !== null && cotacaoIfood.tempoMaximoMin !== null
                              ? ` · ${cotacaoIfood.tempoMinimoMin}–${cotacaoIfood.tempoMaximoMin} min`
                              : ''
                          }`
                        : cotacaoIfood.estado === 'carregando'
                          ? 'Calculando a taxa de entrega…'
                          : cotacaoIfood.estado === 'indisponivel'
                            ? 'Entregador iFood indisponível para este endereço agora — a loja faz a entrega com a taxa dela.'
                            : 'Informe rua e número (ou marque o ponto no mapa) para calcular a taxa de entrega.'}
                    </p>
                  )}

                  {usaTaxaPorBairro && !entregaValida && (
                    <p className="text-[11px] font-semibold leading-relaxed text-amber-700">
                      Para continuar, escolha o bairro na lista e informe rua e número (ou marque o ponto no mapa).
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-zinc-200/60 rounded-2xl p-4 space-y-1 shadow-sm">
                <label htmlFor="observacoes-pedido" className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Observações do pedido (opcional)
                </label>
                <textarea
                  id="observacoes-pedido"
                  rows={2}
                  maxLength={280}
                  placeholder="Ex.: sem cebola, portão azul, interfone 12"
                  value={observacoesCliente}
                  onChange={(e) => setObservacoesCliente(e.target.value)}
                  className="w-full resize-none bg-zinc-50/50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:bg-white focus:border-zinc-400 transition-all text-zinc-900 placeholder-zinc-400"
                />
                <p className="text-right text-[11px] text-zinc-400">{observacoesCliente.length}/280</p>
              </div>
            </div>
          )}
          {!modoPix && etapaEfetiva === 'PAGAMENTO' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {erroPagamento && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
                  {erroPagamento}
                </div>
              )}
              {lojaFechada && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
                  A loja está fechada no momento. Volte no horário de funcionamento para finalizar.
                </div>
              )}
              <div className="rounded-2xl border border-zinc-200/60 bg-white p-4 text-xs shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5 text-zinc-600">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Seu pedido será enviado para</p>
                    <p className="font-bold text-zinc-900">{nomeCliente.trim()} · {telefoneCliente}</p>
                    <p>
                      {abaEntregaAtiva === 'RETIRADA'
                        ? `Retirada na loja${enderecoLoja ? ` — ${enderecoLoja}` : ''}`
                        : [rua, numero, bairro].filter(Boolean).join(', ') || 'Local marcado no mapa'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEtapaCheckout('ENTREGA')}
                    className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-bold text-zinc-700 underline underline-offset-2"
                  >
                    Alterar
                  </button>
                </div>
              </div>
              <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-4 space-y-1.5 text-xs font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Subtotal</span>
                  <span className="font-semibold text-zinc-700">{formatarMoeda(valorTotal)}</span>
                </div>
                {taxaEntrega > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Taxa de entrega{taxaPeloIfood ? ' · iFood' : zonaEntregaAtual ? ` · ${zonaEntregaAtual.nome}` : ''}</span>
                    <span className="font-semibold text-zinc-700">{formatarMoeda(taxaEntrega)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-zinc-200/60 pt-1.5">
                  <span className="text-zinc-600 font-bold">Total</span>
                  <span className="font-bold text-zinc-900">{formatarMoeda(valorTotalComTaxa)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Escolher pagamento</span>
                {carregandoPagamento && (
                  <span className="text-[11px] font-semibold text-zinc-500" aria-live="polite">
                    Processando...
                  </span>
                )}
              </div>

              <div className="grid gap-3">
                {aceitaPix(formasPagamento) && (
                  <button
                    type="button"
                    onClick={() => {
                      trackClicouPagarPix({
                        valorTotal: valorTotalComTaxa,
                        itens: itens.map((item) => ({ id: item.produto.id, quantidade: item.quantidade })),
                      });
                      trackAddPaymentInfo({
                        metodo: 'pix',
                        valorTotal: valorTotalComTaxa,
                        itens: itens.map((item) => ({ id: item.produto.id, quantidade: item.quantidade })),
                      });
                      criarPagamento('PIX');
                    }}
                    disabled={carregandoPagamento || lojaFechada || Boolean(dadosPix)}
                    className="min-h-14 rounded-2xl border border-[#E9B31E] bg-[#FFC72C] px-4 py-4 text-left text-zinc-900 shadow-sm disabled:opacity-50"
                  >
                    <div className="text-xs font-bold uppercase tracking-widest">PIX</div>
                    <div className="text-sm font-medium">Pagar com QR Code e copia e cola</div>
                  </button>
                )}

                {aceitaCartao(formasPagamento) && (
                  <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => {
                        if (mpPublicKey) {
                          setCartaoEmbutidoAberto((aberto) => !aberto);
                        } else {
                          void criarPagamento('CARTAO');
                        }
                      }}
                      disabled={carregandoPagamento}
                      aria-expanded={mpPublicKey ? cartaoEmbutidoAberto : undefined}
                      className="w-full px-4 py-4 text-left text-zinc-900 disabled:opacity-50"
                    >
                      <div className="text-xs font-bold uppercase tracking-widest">{rotuloBotaoCartao(formasPagamento)}</div>
                      <div className="text-sm font-medium">
                        {mpPublicKey ? 'Pagar aqui mesmo, sem sair do site' : 'Finalizar no checkout seguro do Mercado Pago'}
                      </div>
                    </button>

                    {mpPublicKey && cartaoEmbutidoAberto && (
                      <div className="space-y-3 border-t border-zinc-100 px-4 pb-4 pt-4">
                        <PagamentoCartaoBrick
                          chavePublica={mpPublicKey}
                          valor={valorTotalComTaxa}
                          aceitaCredito={aceitaCartaoCredito(formasPagamento)}
                          aceitaDebito={aceitaCartaoDebito(formasPagamento)}
                          aoEnviar={pagarComCartaoEmbutido}
                        />
                        <button
                          type="button"
                          onClick={() => void criarPagamento('CARTAO')}
                          disabled={carregandoPagamento}
                          className="w-full text-center text-xs font-semibold text-zinc-500 underline underline-offset-2 disabled:opacity-50"
                        >
                          Prefiro pagar no ambiente do Mercado Pago (aceita saldo em conta)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {urlCheckoutCartao && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
                  Redirecionando para pagamento com cartão...
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] border-t border-zinc-100 bg-white space-y-4 shrink-0 select-none w-full max-w-xl mx-auto">
          <div className={`flex items-center justify-between ${modoPix ? 'hidden' : ''}`}>
            <div>
              <span className="text-[11px] text-zinc-400 block font-bold uppercase tracking-wider">
                {taxaEntrega > 0 ? 'Total com Entrega' : 'Subtotal Líquido'}
              </span>
              <span className="text-xl font-extrabold text-zinc-900 font-mono tracking-tight">
                {formatarMoeda(valorTotalComTaxa)}
              </span>
              {taxaEntrega > 0 && (
                <span className="text-[11px] text-zinc-400 block font-medium mt-0.5">
                  Sacola {formatarMoeda(valorTotal)} + entrega {formatarMoeda(taxaEntrega)}
                </span>
              )}
              {bairroPendente && (
                <span className="text-[11px] text-zinc-400 block font-medium mt-0.5">
                  + taxa de entrega (definida pelo bairro)
                </span>
              )}
            </div>
            {!modoPix && etapaEfetiva !== 'PAGAMENTO' && itens.length > 0 && (
              <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-md border border-zinc-200/40">
                Itens revisados
              </span>
            )}
          </div>

          {!modoPix && etapaEfetiva !== 'PAGAMENTO' && (
            <button
              type="button"
              onClick={handleAcaoPrincipal}
              disabled={
                itens.length === 0 || conferindoSacola || sacolaTemBloqueio || (etapaEfetiva === 'SACOLA' && lojaFechada) || (etapaEfetiva === 'ENTREGA' && !entregaValida)
              }
              className="w-full py-4 px-6 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider transition-all duration-200 active:scale-[0.99] shadow-sm disabled:opacity-30 disabled:pointer-events-none"
            >
              {etapaEfetiva === 'SACOLA'
                ? 'Avançar para Entrega'
                : etapaEfetiva === 'ENTREGA'
                  ? 'Ir para o Pagamento'
                  : null}
            </button>
          )}
        </footer>

      </div>

      {pagamentoConfirmado && trackingPedido && (
        <TelaPagamentoConfirmado
          valor={pagamentoConfirmado.valor}
          numeroPedido={pagamentoConfirmado.numero}
          urlAcompanhamento={`${trackingPedido.tracking_url}?pagamento=aprovado`}
        />
      )}

      {modalMapaCepAberto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="shrink-0 border-b border-zinc-100 p-5 pb-3">
            <h2 className="text-sm font-extrabold text-zinc-900">Marque sua localização no mapa</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Mova o mapa até posicionar o pino no endereço de entrega — a gente preenche os campos
              automaticamente e o entregador recebe o ponto exato.
            </p>
          </div>

          <div className="min-h-0 flex-1 p-5 py-3">
            <SeletorLocalizacaoMapa
              latitudeInicial={clienteLatitude}
              longitudeInicial={clienteLongitude}
              onLocalizacaoConfirmada={handleCapturaTemporariaMapaCep}
              preencherAltura
            />
          </div>

          <div className="flex shrink-0 gap-2 border-t border-zinc-100 p-5 pt-3">
            <button
              type="button"
              onClick={handleCancelarMapaCep}
              className="flex-1 py-3 rounded-xl border border-zinc-200 text-xs font-bold uppercase tracking-wider text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarMapaCep}
              disabled={!resultadoMapaCepPendente}
              className="flex-1 py-3 rounded-xl bg-zinc-900 text-xs font-bold uppercase tracking-wider text-white hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Confirmar localização
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
