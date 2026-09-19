'use client';

import { useEffect, useState } from 'react';
import PagamentoCartaoBrick, { type DadosCartaoBrick } from '@/components/ecommerce/checkout/PagamentoCartaoBrick';
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

// Nova tentativa de pagamento na tela de acompanhamento, para o pedido que continua PENDENTE
// (cartão recusado, PIX que expirou, cliente que fechou a tela...). Usa o MESMO pedido.

interface PropsRetentarPagamentoPedido {
  slug: string;
  codigoAcompanhamento: string;
  valorTotal: number;
}

interface DadosPix {
  qr_code: string;
  qr_code_base64?: string;
}

export function RetentarPagamentoPedido({ slug, codigoAcompanhamento, valorTotal }: PropsRetentarPagamentoPedido) {
  const [formas, setFormas] = useState<FormaPagamentoLoja[]>(FORMAS_PAGAMENTO_PADRAO);
  const [chavePublica, setChavePublica] = useState<string | null>(null);
  const [cartaoAberto, setCartaoAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [pix, setPix] = useState<DadosPix | null>(null);
  const [pixCopiado, setPixCopiado] = useState(false);

  useEffect(() => {
    let ativo = true;
    const carregarLoja = async () => {
      try {
        const resposta = await fetch(`/api/restaurantes/${slug}/resumo`, { cache: 'no-store' });
        if (!resposta.ok) return;
        const body = await resposta.json();
        if (!ativo) return;
        setFormas(normalizarFormasPagamento(body?.formas_pagamento_aceitas));
        setChavePublica(typeof body?.mp_public_key === 'string' && body.mp_public_key ? body.mp_public_key : null);
      } catch (error) {
        console.error('Erro ao carregar formas de pagamento da loja:', error);
      }
    };
    void carregarLoja();
    return () => {
      ativo = false;
    };
  }, [slug]);

  const chamarNovaTentativa = async (paymentMethod: 'PIX' | 'CARTAO', cartao?: DadosCartaoBrick) => {
    const resposta = await fetch('/api/checkout/retomar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, codigoAcompanhamento, paymentMethod, ...(cartao ? { cartao } : {}) }),
    });
    const body = await resposta.json().catch(() => null);
    if (!resposta.ok || !body) {
      throw new Error(body?.error || 'Não foi possível iniciar o pagamento. Tente novamente.');
    }
    return body as Record<string, unknown>;
  };

  const pagarComPix = async () => {
    setCarregando(true);
    setErro('');
    try {
      const body = await chamarNovaTentativa('PIX');
      setPix({ qr_code: String(body.qr_code ?? ''), qr_code_base64: String(body.qr_code_base64 ?? '') });
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível gerar o PIX.');
    } finally {
      setCarregando(false);
    }
  };

  const pagarNoCheckoutMercadoPago = async () => {
    setCarregando(true);
    setErro('');
    try {
      const body = await chamarNovaTentativa('CARTAO');
      if (typeof body.checkout_url === 'string' && body.checkout_url) {
        window.location.href = body.checkout_url;
        return;
      }
      throw new Error('Não foi possível abrir o checkout do Mercado Pago.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível abrir o checkout do Mercado Pago.');
      setCarregando(false);
    }
  };

  // Lança erro (mensagem amigável) se o pagamento não for concluído: o formulário fica livre para outro cartão.
  const pagarComCartaoEmbutido = async (dadosCartao: DadosCartaoBrick) => {
    const body = await chamarNovaTentativa('CARTAO', dadosCartao);
    if (body.status === 'rejected') {
      throw new Error(String(body.mensagem || 'O pagamento foi recusado. Tente outro cartão ou escolha PIX.'));
    }
    // recarrega a tela já com o status atualizado
    window.location.assign(`${window.location.pathname}?pagamento=${body.status === 'approved' ? 'aprovado' : 'pendente'}`);
  };

  const copiarPix = async () => {
    if (!pix?.qr_code) return;
    try {
      await navigator.clipboard.writeText(pix.qr_code);
      setPixCopiado(true);
      window.setTimeout(() => setPixCopiado(false), 2500);
    } catch {
      setErro('Não foi possível copiar. Selecione o código e copie manualmente.');
    }
  };

  const valorFormatado = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <section className="mt-4 rounded-2xl border border-amber-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Pagamento não concluído?</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Tente novamente com outro cartão ou pague com PIX. É o mesmo pedido ({valorFormatado}): você não precisa
        montar a sacola de novo.
      </p>

      <div className="mt-3 grid gap-3">
        {aceitaCartao(formas) && (
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <button
              type="button"
              onClick={() => {
                setErro('');
                if (chavePublica) {
                  setCartaoAberto((aberto) => !aberto);
                } else {
                  void pagarNoCheckoutMercadoPago();
                }
              }}
              disabled={carregando}
              aria-expanded={chavePublica ? cartaoAberto : undefined}
              className="w-full px-4 py-3 text-left text-zinc-900 disabled:opacity-50"
            >
              <div className="text-xs font-bold uppercase tracking-widest">{rotuloBotaoCartao(formas)}</div>
              <div className="text-sm font-medium">
                {chavePublica ? 'Pagar aqui mesmo, com outro cartão' : 'Tentar de novo no checkout do Mercado Pago'}
              </div>
            </button>

            {chavePublica && cartaoAberto && (
              <div className="space-y-3 border-t border-zinc-100 px-4 pb-4 pt-4">
                <PagamentoCartaoBrick
                  chavePublica={chavePublica}
                  valor={valorTotal}
                  aceitaCredito={aceitaCartaoCredito(formas)}
                  aceitaDebito={aceitaCartaoDebito(formas)}
                  aoEnviar={pagarComCartaoEmbutido}
                />
                <button
                  type="button"
                  onClick={() => void pagarNoCheckoutMercadoPago()}
                  disabled={carregando}
                  className="w-full text-center text-xs font-semibold text-zinc-500 underline underline-offset-2 disabled:opacity-50"
                >
                  Prefiro pagar no ambiente do Mercado Pago (aceita saldo em conta)
                </button>
              </div>
            )}
          </div>
        )}

        {aceitaPix(formas) && (
          <button
            type="button"
            onClick={() => void pagarComPix()}
            disabled={carregando}
            className="rounded-2xl border border-[#E9B31E] bg-[#FFC72C] px-4 py-3 text-left text-zinc-900 shadow-sm disabled:opacity-50"
          >
            <div className="text-xs font-bold uppercase tracking-widest">PIX</div>
            <div className="text-sm font-medium">{pix ? 'Gerar um novo PIX' : 'Pagar com QR Code e copia e cola'}</div>
          </button>
        )}
      </div>

      {erro && (
        <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {erro}
        </div>
      )}

      {pix && (
        <div className="mt-3 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold text-zinc-800">Seu PIX foi gerado</div>
          {pix.qr_code_base64 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${pix.qr_code_base64}`}
              alt="QR Code do PIX"
              className="mx-auto h-48 w-48 rounded-xl border border-zinc-100"
            />
          )}
          <textarea
            readOnly
            value={pix.qr_code}
            rows={3}
            className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600"
          />
          <button
            type="button"
            onClick={() => void copiarPix()}
            className="w-full rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-semibold text-white"
          >
            {pixCopiado ? 'Código copiado!' : 'Copiar código PIX'}
          </button>
          <p className="text-center text-[11px] text-zinc-400">Assim que o pagamento for confirmado, esta tela atualiza sozinha.</p>
        </div>
      )}
    </section>
  );
}
