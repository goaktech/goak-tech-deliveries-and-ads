'use client';

import React from 'react';
import { ResumoMetricasFunil } from '@/actions/adminMetricas';

interface CardsPerformanceGrowthProps {
  dados: ResumoMetricasFunil;
}

export function CardsPerformanceGrowth({ dados }: CardsPerformanceGrowthProps) {
  const percentualCmvDiario = dados.faturamentoTotal > 0 
    ? Math.round((dados.custoInsumosTotal / dados.faturamentoTotal) * 100) 
    : 0;

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      
      <div className="select-none rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Faturamento Líquido (Stripe)
        </span>
        <h3 className="font-mono text-2xl font-bold tracking-tight text-[#1A1A1A]">
          {formatarMoeda(dados.faturamentoTotal)}
        </h3>
        <span className="mt-2 block text-[11px] font-medium text-zinc-500">
          Dinheiro real processado hoje
        </span>
      </div>

      <div className="select-none rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Custo de Mercadoria (CMV)
          </span>
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-600">
            {percentualCmvDiario}% do faturamento
          </span>
        </div>
        <h3 className="mt-1 font-mono text-2xl font-bold tracking-tight text-zinc-700">
          {formatarMoeda(dados.custoInsumosTotal)}
        </h3>
        <span className="mt-2 block text-[11px] font-medium text-zinc-500">
          Custo escoado do estoque de hoje
        </span>
      </div>

      <div className="select-none rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[#E16349]">
          Margem de Contribuição Bruta
        </span>
        <h3 className="font-mono text-2xl font-bold tracking-tight text-[#E16349]">
          {formatarMoeda(dados.lucroOperacionalBruto)}
        </h3>
        <span className="mt-2 block text-[11px] font-medium text-zinc-500">
          Saldo real antes do CPA do Meta
        </span>
      </div>

    </div>
  );
}
