'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AtivadorPushPedido } from '@/components/ecommerce/acompanhamento/AtivadorPushPedido';
import { RetentarPagamentoPedido } from '@/components/ecommerce/acompanhamento/RetentarPagamentoPedido';
import {
  type DadosClientePedido,
  type StatusPedido,
  formatarNumeroPedido,
  obterDescricaoStatusPedido,
  obterEtapasStatusPedido,
  obterIndiceStatusPedido,
  obterTituloStatusPedido,
  obterTipoEntregaPedido,
} from '@/utils/pedido-status';

interface PedidoAcompanhamento {
  id: string;
  status: StatusPedido;
  valor_total: number;
  forma_pagamento: string;
  created_at: string;
  updated_at: string;
  codigo_acompanhamento: string;
  codigo_confirmacao_entrega: string;
  mercado_pago_payment_id: string | null;
  dados_cliente: DadosClientePedido;
  endereco_entrega: string | null;
  tipo_entrega: 'ENTREGA' | 'RETIRADA';
  distancia_entrega_km: number | null;
  tempo_deslocamento_min: number | null;
  tempo_preparo_estimado_min: number | null;
  numero_pedido?: number | null;
  motivo_cancelamento?: string | null;
  restaurante: {
    nome: string;
    slug: string;
    endereco: string | null;
  };
  itens: Array<{
    id: string;
    nome: string;
    imagem_url: string | null;
    quantidade: number;
    preco_unitario: number;
    adicionais: Array<{ id: string; nome: string; preco_adicional: number }>;
  }>;
}

interface PainelAcompanhamentoPedidoProps {
  pedidoInicial: PedidoAcompanhamento;
  pagamento?: string;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(data: string) {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PainelAcompanhamentoPedido({ pedidoInicial, pagamento }: PainelAcompanhamentoPedidoProps) {
  const [pedido, setPedido] = useState(pedidoInicial);
  const [erro, setErro] = useState('');
  const tipoEntrega = useMemo(() => obterTipoEntregaPedido(pedido.dados_cliente), [pedido.dados_cliente]);
  const etapas = useMemo(() => obterEtapasStatusPedido(tipoEntrega), [tipoEntrega]);
  const indiceAtual = useMemo(() => obterIndiceStatusPedido(pedido.status, tipoEntrega), [pedido.status, tipoEntrega]);

  const emFaseEntrega = pedido.status === 'SAIU_PARA_ENTREGA';
  const cancelado = pedido.status === 'CANCELADO';
  const finalizado = cancelado || pedido.status === 'ENTREGUE';

  // O aviso de pagamento reflete o status REAL do pedido (confirmado pelo webhook do Mercado Pago),
  // e não apenas o parâmetro ?pagamento= da URL, que vem do redirecionamento do checkout e não prova nada.
  const bannerPagamento = useMemo(() => {
    if (pedido.status === 'CANCELADO') {
      return null;
    }
    if (pedido.status !== 'PENDENTE') {
      return pagamento
        ? {
            classe: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            texto: 'Pagamento confirmado. Acompanhe as próximas etapas abaixo.',
          }
        : null;
    }
    if (pagamento === 'falhou') {
      return {
        classe: 'border-red-200 bg-red-50 text-red-700',
        texto: 'O pagamento não foi concluído. Você pode tentar novamente logo abaixo.',
      };
    }
    if (pagamento) {
      return {
        classe: 'border-amber-200 bg-amber-50 text-amber-700',
        texto: 'Aguardando a confirmação do pagamento pelo Mercado Pago. Esta página atualiza sozinha.',
      };
    }
    return null;
  }, [pagamento, pedido.status]);

  useEffect(() => {
    if (finalizado) {
      return;
    }

    let ativo = true;

    const sincronizarPedido = async () => {
      try {
        const resposta = await fetch(`/api/pedidos/acompanhar/${pedido.codigo_acompanhamento}?slug=${pedido.restaurante.slug}`, {
          cache: 'no-store',
        });
        const body = await resposta.json();
        if (!resposta.ok) {
          throw new Error(body?.error || 'Falha ao atualizar pedido.');
        }
        if (ativo) {
          setPedido(body);
          setErro('');
        }
      } catch (error) {
        if (ativo) {
          setErro(error instanceof Error ? error.message : 'Falha ao atualizar pedido.');
        }
      }
    };

    const intervalo = window.setInterval(() => {
      void sincronizarPedido();
    }, 8000);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
    };
  }, [finalizado, pedido.codigo_acompanhamento, pedido.restaurante.slug]);

  return (
    <main className="min-h-screen bg-[#F8F8F8] px-4 py-6 text-[#1A1A1A] sm:px-6 md:py-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E16349]">Acompanhamento do pedido</span>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">{pedido.restaurante.nome}</h1>
              <p className="mt-1 text-xs text-zinc-500">Pedido #{formatarNumeroPedido(pedido.numero_pedido, pedido.codigo_acompanhamento)}</p>
            </div>
            <Link href={`/${pedido.restaurante.slug}`} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900">
              Voltar ao cardápio
            </Link>
          </div>

          {bannerPagamento ? (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs ${bannerPagamento.classe}`}>
              {bannerPagamento.texto}
            </div>
          ) : null}

          {pedido.status === 'PENDENTE' && (
            <RetentarPagamentoPedido
              slug={pedido.restaurante.slug}
              codigoAcompanhamento={pedido.codigo_acompanhamento}
              valorTotal={pedido.valor_total}
            />
          )}

          {cancelado ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-700">Status atual</p>
              <h2 className="mt-1 text-lg font-semibold text-red-900">Pedido cancelado</h2>
              {pedido.motivo_cancelamento ? (
                <p className="mt-1 text-sm text-red-800">Motivo: {pedido.motivo_cancelamento}</p>
              ) : null}
              <p className="mt-3 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-zinc-700 shadow-sm">
                Se você já pagou, fale com a loja sobre a devolução do valor.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Status atual</p>
                  <h2 className="mt-1 text-lg font-semibold text-zinc-900">
                    {obterTituloStatusPedido(pedido.status, tipoEntrega)}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">{obterDescricaoStatusPedido(pedido.status, tipoEntrega)}</p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm">
                  {pedido.forma_pagamento}
                </div>
              </div>

              {emFaseEntrega ? (
                // TEMPORÁRIO: enquanto a disponibilidade de motoboy estiver instável,
                // escondemos tanto a contagem de preparo quanto a de entrega em minutos
                // (que ficavam aqui, uma embaixo da outra) — o tempo estimado passa a ser
                // combinado por WhatsApp. Os componentes LinhaContagemRegressiva /
                // ContagemRegressiva usados antes ficaram só no histórico do git; reverter
                // restaurando os dois blocos (Preparo com totalMinutos={pedido.tempo_preparo_estimado_min}
                // referenciaIso={pedido.created_at}, Entrega com totalMinutos={pedido.tempo_deslocamento_min}
                // referenciaIso={pedido.updated_at}) assim que a entrega estiver estabilizada.
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E16349] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E16349]" />
                    </span>
                    <p className="text-xs font-semibold text-zinc-700">
                      Vamos enviar as informações sobre o tempo de entrega no seu WhatsApp.
                    </p>
                  </div>
                </div>
              ) : pedido.status === 'PRONTO' ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                  <svg className="h-4 w-4 shrink-0 text-[#E16349]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                    <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-xs font-semibold text-zinc-700">
                    {tipoEntrega === 'RETIRADA'
                      ? 'Já pode retirar na loja.'
                      : 'Sai para entrega a qualquer momento. Vamos enviar as informações sobre o tempo de entrega no seu WhatsApp.'}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {!cancelado && (
          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900">Linha do tempo</h3>
              <span className="text-[11px] text-zinc-400">Atualizado em {formatarData(pedido.updated_at)}</span>
            </div>
            <div className="mt-4 space-y-3">
              {etapas.map((etapa, index) => {
                const concluida = index <= indiceAtual;
                const ativa = etapa.chave === pedido.status;
                return (
                  <div key={etapa.chave} className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold ${concluida ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-zinc-200 bg-white text-zinc-400'}`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${ativa ? 'text-zinc-900' : 'text-zinc-600'}`}>{etapa.titulo}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{etapa.descricao}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {erro ? <p className="mt-4 text-xs text-red-600">{erro}</p> : null}
          </section>
        )}

        {!finalizado && <AtivadorPushPedido trackingToken={pedido.codigo_acompanhamento} />}

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900">Resumo do pedido</h3>
          <div className="mt-4 space-y-3">
            {pedido.itens.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                {item.imagem_url ? (
                  <Image src={item.imagem_url} alt={item.nome} width={56} height={56} className="h-14 w-14 rounded-xl object-cover" unoptimized />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-xs font-bold text-zinc-400 shadow-inner">
                    {item.nome.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900">{item.nome}</p>
                  <p className="mt-1 text-xs text-zinc-500">{item.quantidade}x • {formatarMoeda(item.preco_unitario)}</p>
                  {item.adicionais.length > 0 ? (
                    <p className="mt-1 text-[11px] text-zinc-400">
                      + {item.adicionais.map((adicional) => adicional.nome).join(', ')}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-sm font-semibold text-zinc-900">
                  {formatarMoeda(item.preco_unitario * item.quantidade)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
            <span className="text-sm text-zinc-500">Total</span>
            <span className="text-lg font-semibold text-zinc-900">{formatarMoeda(pedido.valor_total)}</span>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900">Entrega e contato</h3>
          {emFaseEntrega ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">Código de confirmação</p>
              <p className="mt-1 text-2xl font-extrabold tracking-widest text-amber-900">
                {pedido.codigo_confirmacao_entrega}
              </p>
              <p className="mt-1 text-xs text-amber-800">Informe este código ao entregador na hora da entrega.</p>
            </div>
          ) : null}
          <div className="mt-4 space-y-2 text-sm text-zinc-600">
            <p><span className="font-semibold text-zinc-900">Cliente:</span> {pedido.dados_cliente.nome}</p>
            <p><span className="font-semibold text-zinc-900">WhatsApp:</span> {pedido.dados_cliente.telefone}</p>
            <p><span className="font-semibold text-zinc-900">Tipo:</span> {tipoEntrega === 'RETIRADA' ? 'Retirada na loja' : 'Entrega'}</p>
            {tipoEntrega === 'RETIRADA' ? (
              <p><span className="font-semibold text-zinc-900">Endereço da loja:</span> {pedido.restaurante.endereco || 'Consulte a loja para o endereço de retirada.'}</p>
            ) : (
              <p><span className="font-semibold text-zinc-900">Endereço de entrega:</span> {pedido.endereco_entrega || 'Endereço não informado.'}</p>
            )}
            <p><span className="font-semibold text-zinc-900">Canal extra:</span> Você também receberá atualizações no WhatsApp cadastrado.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
