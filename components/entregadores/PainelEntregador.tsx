'use client';

import { useEffect, useState } from 'react';
import type { PedidoParaEntregador } from '@/utils/entregadores';
import { formatarEnderecoPedido } from '@/utils/pedido-status';

interface PainelEntregadorProps {
  token: string;
  nomeEntregador: string;
  disponiveisIniciais: PedidoParaEntregador[];
  ativosIniciais: PedidoParaEntregador[];
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarHora(dataString: string) {
  try {
    return new Date(dataString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function montarUrlNavegacaoAteCliente(pedido: PedidoParaEntregador): string {
  if (pedido.clienteLatitude != null && pedido.clienteLongitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${pedido.clienteLatitude},${pedido.clienteLongitude}&travelmode=driving`;
  }
  const enderecoTexto = formatarEnderecoPedido(pedido.dadosCliente);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(enderecoTexto ?? '')}&travelmode=driving`;
}

export function PainelEntregador({ token, nomeEntregador, disponiveisIniciais, ativosIniciais }: PainelEntregadorProps) {
  const [disponiveis, setDisponiveis] = useState(disponiveisIniciais);
  const [ativos, setAtivos] = useState(ativosIniciais);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [codigosInformados, setCodigosInformados] = useState<Record<string, string>>({});

  const sincronizar = async () => {
    try {
      const resposta = await fetch(`/api/entregadores/${token}/pedidos`, { cache: 'no-store' });
      if (!resposta.ok) return;
      const body = await resposta.json();
      setDisponiveis(body.disponiveis ?? []);
      setAtivos(body.ativos ?? []);
    } catch (error) {
      console.error('Falha ao sincronizar pedidos do entregador:', error);
    }
  };

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      void sincronizar();
    }, 8000);
    return () => window.clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapturar = async (pedidoId: string) => {
    setErro('');
    setProcessandoId(pedidoId);
    try {
      const resposta = await fetch(`/api/entregadores/${token}/capturar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pedidoId }),
      });
      const body = await resposta.json();
      if (!resposta.ok) {
        throw new Error(body?.error || 'Falha ao capturar pedido.');
      }
      await sincronizar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao capturar pedido.');
    } finally {
      setProcessandoId(null);
    }
  };

  const handleConcluir = async (pedidoId: string) => {
    setErro('');
    setProcessandoId(pedidoId);
    try {
      const resposta = await fetch(`/api/entregadores/${token}/concluir`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pedidoId, codigoConfirmacao: codigosInformados[pedidoId] ?? '' }),
      });
      const body = await resposta.json();
      if (!resposta.ok) {
        throw new Error(body?.error || 'Falha ao concluir entrega.');
      }
      setCodigosInformados((atual) => {
        const proximo = { ...atual };
        delete proximo[pedidoId];
        return proximo;
      });
      await sincronizar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao concluir entrega.');
    } finally {
      setProcessandoId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F8F8] px-4 py-6 text-[#1A1A1A] sm:px-6 md:py-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E16349]">Painel do entregador</span>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">Olá, {nomeEntregador}</h1>
          <p className="mt-1 text-xs text-zinc-500">Essa lista atualiza sozinha. Toque em atualizar se quiser forçar agora.</p>
          <button
            type="button"
            onClick={() => void sincronizar()}
            className="mt-3 rounded-xl border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
          >
            Atualizar agora
          </button>
        </section>

        {erro ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{erro}</div>
        ) : null}

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Suas entregas em rota</h2>
          <div className="mt-4 space-y-3">
            {ativos.length === 0 ? (
              <p className="text-xs text-zinc-400">Nenhuma entrega em rota agora.</p>
            ) : (
              ativos.map((pedido) => (
                <div key={pedido.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">{pedido.dadosCliente.nome}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{pedido.dadosCliente.telefone}</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {formatarEnderecoPedido(pedido.dadosCliente) ?? 'Endereço não informado.'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-zinc-500">{formatarHora(pedido.createdAt)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                    <span>{formatarMoeda(pedido.valorTotal)}</span>
                    {pedido.distanciaEntregaKm != null ? <span>{pedido.distanciaEntregaKm} km</span> : null}
                  </div>
                  <a
                    href={montarUrlNavegacaoAteCliente(pedido)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-white py-2 text-xs font-semibold uppercase tracking-wide text-blue-700 transition hover:bg-blue-50"
                  >
                    Navegar até o cliente
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Código do cliente"
                    value={codigosInformados[pedido.id] ?? ''}
                    onChange={(e) =>
                      setCodigosInformados((atual) => ({
                        ...atual,
                        [pedido.id]: e.target.value.replace(/\D/g, '').slice(0, 4),
                      }))
                    }
                    className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-center text-sm font-semibold tracking-[0.3em] text-zinc-900 focus:border-zinc-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleConcluir(pedido.id)}
                    disabled={processandoId === pedido.id || (codigosInformados[pedido.id] ?? '').length !== 4}
                    className="mt-2 w-full rounded-xl bg-zinc-900 py-2 text-xs font-semibold uppercase tracking-wide text-white transition disabled:opacity-50"
                  >
                    {processandoId === pedido.id ? 'Confirmando...' : 'Confirmar entrega'}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Pedidos disponíveis para captura</h2>
          <div className="mt-4 space-y-3">
            {disponiveis.length === 0 ? (
              <p className="text-xs text-zinc-400">Nenhum pedido disponível agora.</p>
            ) : (
              disponiveis.map((pedido) => (
                <div key={pedido.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">{pedido.dadosCliente.nome}</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {formatarEnderecoPedido(pedido.dadosCliente) ?? 'Endereço não informado.'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-zinc-500">{formatarHora(pedido.createdAt)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                    <span>{formatarMoeda(pedido.valorTotal)}</span>
                    {pedido.distanciaEntregaKm != null ? <span>{pedido.distanciaEntregaKm} km</span> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCapturar(pedido.id)}
                    disabled={processandoId === pedido.id}
                    className="mt-3 w-full rounded-xl bg-[#E16349] py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-[#c9533a] disabled:opacity-50"
                  >
                    {processandoId === pedido.id ? 'Capturando...' : 'Capturar pedido'}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
