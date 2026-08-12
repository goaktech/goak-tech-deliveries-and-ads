'use client';

import React, { useState } from 'react';
import { useCozinha } from './useCozinha';
import { BarraNavegacaoCozinha } from '@/components/cozinha/BarraNavegacaoCozinha';
import { ColunaEsteiraCozinha } from '@/components/cozinha/ColunaEsteiraCozinha';

type EtapaCozinha = 'novos' | 'preparo' | 'prontos' | 'caminho';

export default function PainelCozinhaAdmin() {
  const {
    pedidos,
    entregadores,
    loading,
    sincronizando,
    isPending,
    executarReconciliacaoPedidos,
    alterarStatusPedido,
    atribuirEntregador,
  } = useCozinha();

  const [etapaAtiva, setEtapaAtiva] = useState<EtapaCozinha>('novos');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F3F3] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E16349] border-t-transparent" />
      </div>
    );
  }

  const pedidosNovos = pedidos.filter(p => p.status === 'PENDENTE' || p.status === 'PAGO');
  const pedidosPreparo = pedidos.filter(p => p.status === 'PREPARANDO');
  const pedidosProntos = pedidos.filter(p => p.status === 'PRONTO');
  const pedidosACaminho = pedidos.filter(p => p.status === 'SAIU_PARA_ENTREGA');

  const etapas: { id: EtapaCozinha; titulo: string; pedidos: typeof pedidos }[] = [
    { id: 'novos', titulo: 'Entrada / Pagos', pedidos: pedidosNovos },
    { id: 'preparo', titulo: 'Em Preparo', pedidos: pedidosPreparo },
    { id: 'prontos', titulo: 'Pronto para Envio', pedidos: pedidosProntos },
    { id: 'caminho', titulo: 'A Caminho', pedidos: pedidosACaminho },
  ];
  const etapaSelecionada = etapas.find((etapa) => etapa.id === etapaAtiva) ?? etapas[0];

  return (
    <div className="min-h-screen bg-[#F3F3F3] text-[#1A1A1A] font-sans antialiased flex items-start justify-center p-4 sm:p-8 md:py-12">
      <div className="w-full max-w-4xl space-y-6">

        <BarraNavegacaoCozinha />

        <header className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between select-none">
          <div className="leading-tight">
            <h1 className="text-xl font-bold tracking-tight text-[#1A1A1A]">Monitor de produção</h1>
            <span className="mt-0.5 block text-[11px] font-semibold text-zinc-500">Fila de pedidos ativa em tempo real</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={executarReconciliacaoPedidos}
              disabled={sincronizando}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Em tempo real</span>
            </div>
          </div>
        </header>

        <nav className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-[#F3F3F3] p-1.5">
          {etapas.map((etapa) => {
            const ativa = etapa.id === etapaAtiva;
            return (
              <button
                key={etapa.id}
                type="button"
                onClick={() => setEtapaAtiva(etapa.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-all ${
                  ativa ? 'bg-[#E16349] font-bold text-white shadow-sm' : 'font-medium text-zinc-600 hover:text-[#1A1A1A]'
                }`}
              >
                {etapa.titulo}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono font-semibold ${ativa ? 'bg-white/20 text-white' : 'bg-white text-zinc-500'}`}>
                  {etapa.pedidos.length}
                </span>
              </button>
            );
          })}
        </nav>

        <ColunaEsteiraCozinha
          titulo={etapaSelecionada.titulo}
          pedidos={etapaSelecionada.pedidos}
          onAvancarStatus={alterarStatusPedido}
          isMutating={isPending}
          entregadores={entregadores}
          onAtribuirEntregador={atribuirEntregador}
          exibirCabecalho={false}
        />

      </div>
    </div>
  );
}
