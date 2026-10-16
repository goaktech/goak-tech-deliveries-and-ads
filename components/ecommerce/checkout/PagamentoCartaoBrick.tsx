'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface DadosCartaoBrick {
  token: string;
  payment_method_id: string;
  issuer_id?: string | number | null;
  installments?: number;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
  device_id?: string | null;
}

interface PropsPagamentoCartaoBrick {
  chavePublica: string;
  valor: number;
  aceitaCredito: boolean;
  aceitaDebito: boolean;
  aoEnviar: (dados: DadosCartaoBrick) => Promise<void>;
  aoFalharCarregamento?: () => void;
}

interface ControladorBrick {
  unmount: () => void;
}

interface BricksBuilder {
  create: (tipo: 'cardPayment', idContainer: string, config: unknown) => Promise<ControladorBrick>;
}

interface MercadoPagoSdk {
  bricks: () => BricksBuilder;
}

declare global {
  interface Window {
    MercadoPago?: new (chavePublica: string, opcoes?: { locale?: string }) => MercadoPagoSdk;
    MP_DEVICE_SESSION_ID?: string;
  }
}

const URL_SDK_MERCADO_PAGO = 'https://sdk.mercadopago.com/js/v2';
const ID_CONTAINER_BRICK = 'brick-cartao-container';

let promessaSdk: Promise<void> | null = null;

function carregarSdkMercadoPago(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SDK indisponível no servidor.'));
  if (window.MercadoPago) return Promise.resolve();
  if (promessaSdk) return promessaSdk;

  promessaSdk = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = URL_SDK_MERCADO_PAGO;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      promessaSdk = null;
      script.remove();
      reject(new Error('Não foi possível carregar o formulário de cartão.'));
    };
    document.head.appendChild(script);
  });

  return promessaSdk;
}

export default function PagamentoCartaoBrick({
  chavePublica,
  valor,
  aceitaCredito,
  aceitaDebito,
  aoEnviar,
  aoFalharCarregamento,
}: PropsPagamentoCartaoBrick) {
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [erroPagamento, setErroPagamento] = useState('');
  const aoEnviarRef = useRef(aoEnviar);
  const aoFalharRef = useRef(aoFalharCarregamento);

  useEffect(() => {
    aoEnviarRef.current = aoEnviar;
    aoFalharRef.current = aoFalharCarregamento;
  });

  useEffect(() => {
    let cancelado = false;
    let controlador: ControladorBrick | null = null;

    const excluidos = ['prepaid_card'];
    if (!aceitaCredito) excluidos.push('credit_card');
    if (!aceitaDebito) excluidos.push('debit_card');

    const iniciar = async () => {
      try {
        await carregarSdkMercadoPago();
        if (cancelado || !window.MercadoPago) return;

        const mp = new window.MercadoPago(chavePublica, { locale: 'pt-BR' });
        const criado = await mp.bricks().create('cardPayment', ID_CONTAINER_BRICK, {
          initialization: { amount: Number(valor.toFixed(2)) },
          customization: {
            visual: {
              hideFormTitle: true,
              texts: { formSubmit: 'Pagar agora' },
              style: {
                customVariables: {
                  baseColor: '#1A1A1A',
                  formBackgroundColor: '#FFFFFF',
                  inputBackgroundColor: '#FAFAFA',
                  borderRadiusMedium: '12px',
                  borderRadiusLarge: '16px',
                },
              },
            },
            paymentMethods: {
              maxInstallments: 1,
              types: { excluded: excluidos },
            },
          },
          callbacks: {
            onReady: () => {
              if (!cancelado) setCarregando(false);
            },
            onSubmit: async (dadosFormulario: DadosCartaoBrick) => {
              setErroPagamento('');
              try {
                await aoEnviarRef.current({
                  ...dadosFormulario,
                  device_id: window.MP_DEVICE_SESSION_ID ?? null,
                });
              } catch (erro) {
                setErroPagamento(erro instanceof Error ? erro.message : 'Não foi possível concluir o pagamento.');
                throw erro;
              }
            },
            onError: (erro: { type?: string; cause?: string; message?: string }) => {
              console.error('Erro no formulário de cartão do Mercado Pago:', erro);
              if (cancelado || erro?.type !== 'critical') return;
              setCarregando(false);
              setErroCarregamento(
                /amount/i.test(erro?.message ?? '')
                  ? 'O valor deste pedido está abaixo do mínimo aceito para pagamento com cartão. Escolha PIX ou adicione mais itens.'
                  : 'Não foi possível carregar o formulário de cartão. Use a opção do Mercado Pago abaixo ou escolha PIX.'
              );
              aoFalharRef.current?.();
            },
          },
        });

        if (cancelado) {
          criado.unmount();
          return;
        }
        controlador = criado;
      } catch (erro) {
        console.error(erro);
        if (cancelado) return;
        setCarregando(false);
        setErroCarregamento(erro instanceof Error ? erro.message : 'Não foi possível carregar o formulário de cartão.');
        aoFalharRef.current?.();
      }
    };

    void iniciar();

    return () => {
      cancelado = true;
      try {
        controlador?.unmount();
      } catch {
      }
    };
  }, [chavePublica, valor, aceitaCredito, aceitaDebito]);

  return (
    <div className="space-y-3">
      {carregando && !erroCarregamento && (
        <div className="space-y-2" aria-live="polite">
          <div className="h-11 animate-pulse rounded-xl bg-zinc-100" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-11 animate-pulse rounded-xl bg-zinc-100" />
            <div className="h-11 animate-pulse rounded-xl bg-zinc-100" />
          </div>
          <div className="h-11 animate-pulse rounded-xl bg-zinc-100" />
          <p className="text-center text-xs text-zinc-400">Carregando formulário seguro…</p>
        </div>
      )}

      {erroCarregamento && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{erroCarregamento}</div>
      )}

      <div id={ID_CONTAINER_BRICK} />

      {erroPagamento && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {erroPagamento}
        </div>
      )}

      <p className="text-center text-[11px] text-zinc-400">
        Pagamento processado com segurança pelo Mercado Pago. Os dados do cartão não passam pelo nosso servidor.
      </p>
    </div>
  );
}
