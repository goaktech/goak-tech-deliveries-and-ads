'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import AbasEntrega from '@/components/ecommerce/checkout/AbasEntrega';
import CampoCepEntrega from '@/components/ecommerce/checkout/CampoCepEntrega';
import CartaoRetirada from '@/components/ecommerce/checkout/CartaoRetirada';
import FormularioEnderecoEntrega from '@/components/ecommerce/checkout/FormularioEnderecoEntrega';
import { SeletorLocalizacaoMapa, type ResultadoLocalizacaoMapa } from '@/components/shared/SeletorLocalizacaoMapa';
import type { AbaEntregaCheckout, EtapaCheckout } from '@/components/ecommerce/checkout/tipos';
import { trackInitiateCheckout, trackPurchase, trackClicouPagarPix } from '@/utils/meta-pixel';
import { registrarCheckoutIniciadoFunil } from '@/actions/metricasFunil';
import { obterConfigLojaEspecial } from '@/utils/config-lojas-especiais';

export default function TelaDeCheckoutDedicada() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || '';

  const configLoja = useMemo(() => obterConfigLojaEspecial(slug), [slug]);
  const taxaEntrega = configLoja.taxaEntregaFixa;

  const { itens, adicionarItem, removerItem, valorTotal, totalItens, limparCarrinho } = useCarrinho();
  const valorTotalComTaxa = valorTotal + taxaEntrega;

  const [etapaCheckout, setEtapaCheckout] = useState<EtapaCheckout>('SACOLA');

  const [abaEntregaAtiva, setAbaEntregaAtiva] = useState<AbaEntregaCheckout>('CEP');
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [carregandoPagamento, setCarregandoPagamento] = useState(false);
  const [dadosPix, setDadosPix] = useState<{ qr_code: string; qr_code_base64?: string; payment_id: string } | null>(null);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [urlCheckoutCartao, setUrlCheckoutCartao] = useState<string | null>(null);
  const [trackingPedido, setTrackingPedido] = useState<{
    tracking_url: string;
    codigo_acompanhamento: string;
    pedido_id: string;
    estimativaMin: number | null;
  } | null>(null);
  const [enderecoLoja, setEnderecoLoja] = useState('Endereço do estabelecimento');
  const [latitudeLoja, setLatitudeLoja] = useState<number | null>(null);
  const [longitudeLoja, setLongitudeLoja] = useState<number | null>(null);

  const [clienteLatitude, setClienteLatitude] = useState<number | null>(null);
  const [clienteLongitude, setClienteLongitude] = useState<number | null>(null);
  const [modalMapaCepAberto, setModalMapaCepAberto] = useState(false);
  const [resultadoMapaCepPendente, setResultadoMapaCepPendente] = useState<ResultadoLocalizacaoMapa | null>(null);

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

  const dadosContatoPreenchidos = nomeCliente.trim().length > 0 && telefoneCliente.trim().length > 0;

  const dadosEndereco = useMemo(
    () => ({
      rua,
      numero,
      bairro,
      cidade: 'Cidade',
      cep,
    }),
    [bairro, cep, numero, rua]
  );

  const handleVoltarClique = () => {
    if (etapaCheckout === 'PAGAMENTO') {
      setEtapaCheckout('ENTREGA');
    } else if (etapaCheckout === 'ENTREGA') {
      setEtapaCheckout('SACOLA');
    } else {
      router.push(`/${slug}`);
    }
  };

  const handleAcaoPrincipal = (e: React.FormEvent) => {
    e.preventDefault();
    if (etapaCheckout === 'SACOLA') {
      if (itens.length === 0) return;
      trackInitiateCheckout({
        itens: itens.map((item) => ({ id: item.produto.id, quantidade: item.quantidade })),
        valorTotal,
      });
      void registrarCheckoutIniciadoFunil(slug);
      setEtapaCheckout('ENTREGA');
    } else if (etapaCheckout === 'ENTREGA') {
      if (!dadosContatoPreenchidos) return;
      setEtapaCheckout('PAGAMENTO');
    }
  };

  const criarPagamento = async (novoMetodo: 'PIX' | 'CARTAO') => {
    setCarregandoPagamento(true);
    setDadosPix(null);
    setPixCopiado(false);
    setUrlCheckoutCartao(null);
    setTrackingPedido(null);

    try {
      const resposta = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug,
          paymentMethod: novoMetodo,
          itens: itens.map((item) => ({
            item_cardapio_id: item.produto.id,
            quantidade: item.quantidade,
            complementoIds: item.adicionaisEscolhidos.map((adicional) => adicional.id),
          })),
          dadosCliente: {
            nome: nomeCliente,
            telefone: telefoneCliente,
            email: emailCliente,
            tipoEntrega: abaEntregaAtiva === 'RETIRADA' ? 'RETIRADA' : 'ENTREGA',
            endereco: abaEntregaAtiva === 'RETIRADA' ? undefined : dadosEndereco,
          },
          clienteLatitude: abaEntregaAtiva === 'RETIRADA' ? null : clienteLatitude,
          clienteLongitude: abaEntregaAtiva === 'RETIRADA' ? null : clienteLongitude,
        }),
      });

      const body = await resposta.json();
      if (!resposta.ok) {
        throw new Error(body?.error || 'Falha ao iniciar pagamento.');
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
        });
      }

      if (body.pedido_id) {
        trackPurchase({
          pedidoId: body.pedido_id,
          valorTotal: valorTotalComTaxa,
          itens: itens.map((item) => ({ id: item.produto.id, quantidade: item.quantidade })),
        });
      }

      if (novoMetodo === 'PIX') {
        setDadosPix({
          qr_code: body.qr_code,
          qr_code_base64: body.qr_code_base64,
          payment_id: body.payment_id,
        });
      } else if (body.checkout_url) {
        setUrlCheckoutCartao(body.checkout_url);
        limparCarrinho();
        window.location.href = body.checkout_url;
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Falha ao iniciar pagamento.');
    } finally {
      setCarregandoPagamento(false);
    }
  };

  const handleBuscarClientePorTelefone = async () => {
    const digitos = telefoneCliente.replace(/\D/g, '');
    if (digitos.length < 10) return;

    try {
      const resposta = await fetch(`/api/restaurantes/${slug}/clientes?telefone=${encodeURIComponent(digitos)}`);
      const dados = await resposta.json();

      if (!dados?.encontrado) {
        setModalMapaCepAberto(true);
        return;
      }

      if (!nomeCliente && dados.nome) setNomeCliente(dados.nome);
      if (!emailCliente && dados.email) setEmailCliente(dados.email);

      const endereco = dados.endereco as { rua?: string; numero?: string; bairro?: string; cep?: string } | null;
      if (endereco) {
        if (!rua && endereco.rua) setRua(endereco.rua);
        if (!numero && endereco.numero) setNumero(endereco.numero);
        if (!bairro && endereco.bairro) setBairro(endereco.bairro);
        if (!cep && endereco.cep) setCep(endereco.cep);
      }
    } catch (error) {
      console.error('Erro ao buscar cadastro do cliente:', error);
    }
  };

  const handleLocalizacaoConfirmada = (resultado: ResultadoLocalizacaoMapa) => {
    setClienteLatitude(resultado.latitude);
    setClienteLongitude(resultado.longitude);

    if (resultado.endereco) {
      if (resultado.endereco.rua) setRua(resultado.endereco.rua);
      if (resultado.endereco.numero) setNumero(resultado.endereco.numero);
      if (resultado.endereco.bairro) setBairro(resultado.endereco.bairro);
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

  return (
    <main className="min-h-screen w-full bg-[#F8F8F8] text-[#1A1A1A] font-sans antialiased flex flex-col justify-between selection:bg-zinc-900 selection:text-white">

      <div className="w-full max-w-xl mx-auto bg-white flex-1 flex flex-col shadow-sm border-x border-zinc-200/40">

        <header className="p-6 border-b border-zinc-100 flex items-center gap-4 bg-white sticky top-0 z-10 shrink-0">
          <button
            type="button"
            onClick={handleVoltarClique}
            className="w-9 h-9 rounded-xl bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-zinc-800 transition-colors border border-zinc-200/40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-zinc-900">
              {etapaCheckout === 'SACOLA'
                ? 'Revisar Sacola'
                : etapaCheckout === 'ENTREGA'
                  ? 'Finalizar Pedido'
                  : 'Pagamento'}
            </h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
              {etapaCheckout === 'SACOLA'
                ? `Etapa 1 de 3 • ${totalItens} itens`
                : etapaCheckout === 'ENTREGA'
                  ? 'Etapa 2 de 3 • Dados de entrega'
                  : 'Etapa 3 de 3 • PIX ou Cartão'}
            </p>
          </div>
        </header>

        <div className="p-6 space-y-6 flex-1 bg-white">

          {etapaCheckout === 'SACOLA' && (
            <div className="space-y-4">
              {taxaEntrega > 0 && (
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
                    className="bg-white border border-zinc-200/60 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm"
                  >
                    {item.produto.imagem_url ? (
                      <Image
                        src={item.produto.imagem_url}
                        alt={item.produto.nome}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-xl border border-zinc-200/60 object-cover shadow-inner"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-200/60 flex items-center justify-center text-xs font-extrabold text-zinc-400 font-mono shrink-0 shadow-inner">
                        {item.produto.nome.substring(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-zinc-900 text-xs sm:text-sm truncate leading-tight">
                        {item.produto.nome}
                      </h4>
                      <span className="text-xs font-extrabold text-zinc-500 font-mono block mt-1">
                        {formatarMoeda(Number(item.produto.preco_venda) * item.quantidade)}
                      </span>
                    </div>

                    <div className="flex items-center bg-zinc-50 rounded-xl p-1 gap-2 border border-zinc-200/40 shrink-0 select-none">
                      <button
                        type="button"
                        onClick={() => removerItem(item.idUnico)}
                        className="w-6 h-6 rounded-lg bg-white border border-zinc-200/40 flex items-center justify-center text-xs font-extrabold text-zinc-600 hover:bg-zinc-100 shadow-sm transition-colors"
                      >
                        -
                      </button>
                      <span className="text-xs font-extrabold px-1.5 text-zinc-900 font-mono">{item.quantidade}</span>
                      <button
                        type="button"
                        onClick={() => adicionarItem(item.produto, item.adicionaisEscolhidos)}
                        className="w-6 h-6 rounded-lg bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-xs font-extrabold text-white shadow-sm transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {etapaCheckout === 'ENTREGA' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-4 flex justify-between items-center text-xs font-medium">
                <span className="text-zinc-500">Resumo da Compra</span>
                <span className="font-bold text-zinc-900">{totalItens} {totalItens === 1 ? 'item' : 'itens'} na sacola</span>
              </div>

              <div className="bg-white border border-zinc-200/60 rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">WhatsApp para Notificações</label>
                  <input
                    type="tel"
                    required
                    autoFocus
                    placeholder="(00) 99999-9999"
                    value={telefoneCliente}
                    onChange={(e) => setTelefoneCliente(e.target.value)}
                    onBlur={handleBuscarClientePorTelefone}
                    className="w-full bg-zinc-50/50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:bg-white focus:border-zinc-400 transition-all text-zinc-900 placeholder-zinc-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João Silva"
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    className="w-full bg-zinc-50/50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:bg-white focus:border-zinc-400 transition-all text-zinc-900 placeholder-zinc-400"
                  />
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
                    <CampoCepEntrega cep={cep} onChangeCep={setCep} abaAtiva={abaEntregaAtiva} />
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
                    </div>
                  )}

                  {abaEntregaAtiva === 'RETIRADA' && !configLoja.ocultarRetirada && (
                    <CartaoRetirada endereco={enderecoLoja} latitude={latitudeLoja} longitude={longitudeLoja} />
                  )}

                  {abaEntregaAtiva === 'CEP' && (
                    <FormularioEnderecoEntrega
                      rua={rua}
                      onChangeRua={setRua}
                      numero={numero}
                      onChangeNumero={setNumero}
                      bairro={bairro}
                      onChangeBairro={setBairro}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
          {etapaCheckout === 'PAGAMENTO' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-4 space-y-1.5 text-xs font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Subtotal</span>
                  <span className="font-semibold text-zinc-700">{formatarMoeda(valorTotal)}</span>
                </div>
                {taxaEntrega > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Taxa de entrega</span>
                    <span className="font-semibold text-zinc-700">{formatarMoeda(taxaEntrega)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-zinc-200/60 pt-1.5">
                  <span className="text-zinc-600 font-bold">Total</span>
                  <span className="font-bold text-zinc-900">{formatarMoeda(valorTotalComTaxa)}</span>
                </div>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => {
                    trackClicouPagarPix({
                      valorTotal: valorTotalComTaxa,
                      itens: itens.map((item) => ({ id: item.produto.id, quantidade: item.quantidade })),
                    });
                    criarPagamento('PIX');
                  }}
                  disabled={carregandoPagamento}
                  className="rounded-2xl border border-[#E9B31E] bg-[#FFC72C] px-4 py-4 text-left text-zinc-900 shadow-sm disabled:opacity-50"
                >
                  <div className="text-xs font-bold uppercase tracking-widest">PIX</div>
                  <div className="text-sm font-medium">Pagar com QR Code e copia e cola</div>
                </button>

                {/* Pagamento com cartão temporariamente oculto — reative removendo este comentário quando voltar a habilitar.
                <button
                  type="button"
                  onClick={() => criarPagamento('CARTAO')}
                  disabled={carregandoPagamento}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-left text-zinc-900 shadow-sm disabled:opacity-50"
                >
                  <div className="text-xs font-bold uppercase tracking-widest">Cartão de crédito</div>
                  <div className="text-sm font-medium">Finalizar no checkout do Mercado Pago</div>
                </button>
                */}
              </div>

              {dadosPix && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
                  <div className="text-sm font-semibold text-zinc-800">Seu PIX foi gerado</div>
                  {dadosPix.qr_code_base64 && (
                    <Image
                      src={`data:image/png;base64,${dadosPix.qr_code_base64}`}
                      alt="QR Code PIX"
                      width={224}
                      height={224}
                      unoptimized
                      className="mx-auto h-56 w-56 object-contain"
                    />
                  )}
                  <textarea
                    readOnly
                    value={dadosPix.qr_code}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[11px] font-mono text-zinc-700"
                    rows={4}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(dadosPix.qr_code);
                        setPixCopiado(true);
                        setTimeout(() => setPixCopiado(false), 3000);
                      } catch (error) {
                        console.error('Falha ao copiar código PIX:', error);
                      }
                    }}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                      pixCopiado
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-[#E16349] text-white hover:bg-[#c8523a]'
                    }`}
                  >
                    {pixCopiado ? (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path
                            fillRule="evenodd"
                            d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.414l2.793 2.792 6.793-6.793a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Código copiado
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path d="M7 3a2 2 0 00-2 2v9a2 2 0 002 2h7a2 2 0 002-2V8.414A2 2 0 0015.414 7L11 2.586A2 2 0 009.586 2H7z" />
                          <path d="M4 7a2 2 0 00-2 2v9a2 2 0 002 2h7a2 2 0 002-2v-1H6a2 2 0 01-2-2V7z" />
                        </svg>
                        Copiar código Pix (copia e cola)
                      </>
                    )}
                  </button>
                  {trackingPedido ? (
                    // TEMPORÁRIO: enquanto a disponibilidade de motoboy estiver instável, não
                    // exibimos mais a previsão em minutos aqui (que somava preparo + deslocamento
                    // em trackingPedido.estimativaMin) — o tempo de entrega passa a ser combinado
                    // por WhatsApp. Reverter para a previsão em minutos assim que a entrega
                    // estiver estabilizada.
                    <p className="text-center text-xs text-zinc-500">
                      Vamos enviar as informações sobre o tempo de entrega no seu WhatsApp.
                    </p>
                  ) : null}
                  {trackingPedido ? (
                    <Link
                      href={trackingPedido.tracking_url}
                      onClick={() => limparCarrinho()}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-zinc-800"
                    >
                      Acompanhar pedido
                    </Link>
                  ) : null}
                </div>
              )}

              {urlCheckoutCartao && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
                  Redirecionando para pagamento com cartão...
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] border-t border-zinc-100 bg-white space-y-4 shrink-0 select-none w-full max-w-xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">
                {taxaEntrega > 0 ? 'Total com Entrega' : 'Subtotal Líquido'}
              </span>
              <span className="text-xl font-extrabold text-zinc-900 font-mono tracking-tight">
                {formatarMoeda(valorTotalComTaxa)}
              </span>
              {taxaEntrega > 0 && (
                <span className="text-[10px] text-zinc-400 block font-medium mt-0.5">
                  Sacola {formatarMoeda(valorTotal)} + entrega {formatarMoeda(taxaEntrega)}
                </span>
              )}
            </div>
            {etapaCheckout !== 'PAGAMENTO' && itens.length > 0 && (
              <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-md border border-zinc-200/40">
                Itens revisados
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleAcaoPrincipal}
            disabled={
              itens.length === 0 || (etapaCheckout === 'ENTREGA' && !dadosContatoPreenchidos)
            }
            className="w-full py-4 px-6 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider transition-all duration-200 active:scale-[0.99] shadow-sm disabled:opacity-30 disabled:pointer-events-none"
          >
            {etapaCheckout === 'SACOLA'
              ? 'Avançar para Entrega'
              : etapaCheckout === 'ENTREGA'
                ? 'Ir para o Pagamento'
                : carregandoPagamento
                  ? 'Processando...'
                  : 'Escolher pagamento'}
          </button>
        </footer>

      </div>

      {modalMapaCepAberto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="shrink-0 border-b border-zinc-100 p-5 pb-3">
            <h2 className="text-sm font-extrabold text-zinc-900">Marque sua localização no mapa</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Não encontramos um cadastro para esse telefone. Mova o mapa até posicionar o pino no endereço de
              entrega — a gente preenche os campos automaticamente.
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
