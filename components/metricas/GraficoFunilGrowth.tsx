'use client';

import React from 'react';
import { ResumoMetricasFunil } from '@/actions/adminMetricas';

interface GraficoFunilGrowthProps {
  dados: ResumoMetricasFunil;
}

export function GraficoFunilGrowth({ dados }: GraficoFunilGrowthProps) {
  const taxaCheckouts = dados.visitas > 0 ? Math.round((dados.checkouts / dados.visitas) * 100) : 0;
  const isConversaoSaudavel = dados.taxaConversaoCardapio >= 2.5;

  return (
    <div className="select-none space-y-6 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      
      <div className="border-b border-zinc-100 pb-3">
        <h3 className="text-base font-bold uppercase tracking-wider text-[#1A1A1A]">
          Funil de Vendas Líquido
        </h3>
        <span className="mt-0.5 block text-[11px] font-medium text-zinc-500">
          Silhueta estrutural de conversão e escoamento
        </span>
      </div>

      <div className="flex flex-col gap-1 mx-auto max-w-xl w-full">
        
        <div className="w-full">
          <div className="bg-[#F3F3F3] border border-zinc-200/60 rounded-t-[16px] rounded-b-[4px] p-4 flex items-center justify-between shadow-sm">
            <span className="text-[11px] font-semibold tracking-tight uppercase text-[#1A1A1A]">
              1. Visitas ao Cardápio
            </span>
            <span className="rounded-[8px] bg-zinc-200/60 px-2.5 py-0.5 font-mono text-xs font-semibold text-zinc-900">
              {dados.visitas} acessos
            </span>
          </div>
        </div>

        <div className="px-4 w-full">
          <div className="bg-[#EBF1F5] border border-blue-200/60 text-blue-900 rounded-[4px] p-4 flex items-center justify-between shadow-sm">
            <span className="text-[11px] font-semibold tracking-tight uppercase text-blue-950">
              2. Intenções de Compra
            </span>
            <span className="rounded-[8px] bg-blue-200/50 px-2.5 py-0.5 font-mono text-xs font-semibold text-blue-950">
              {dados.checkouts} ({taxaCheckouts}%)
            </span>
          </div>
        </div>

        <div className="px-8 w-full">
          <div 
            className={`rounded-t-[4px] rounded-b-[16px] p-4 flex items-center justify-between shadow-sm border transition-colors duration-300 ${
              isConversaoSaudavel 
                ? 'bg-[#EAF2EC] border-[#C8DCCE] text-[#2D5138]' 
                : 'bg-[#FCECE9] border-[#F4CDA5] text-[#A63A26]'
            }`}
          >
            <span className="text-[11px] font-semibold tracking-tight uppercase">
              3. Pedidos Pagos (Stripe)
            </span>
            <span 
              className={`rounded-[8px] px-2.5 py-0.5 font-mono text-xs font-semibold ${
                isConversaoSaudavel ? 'bg-[#D3E5D9]' : 'bg-[#F7D3CB]'
              }`}
            >
              {dados.compras} ({dados.taxaConversaoCardapio}%)
            </span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-2 border-t border-zinc-100 text-xs">
        
        <div className="bg-white rounded-[16px] p-4 border border-zinc-200/80 shadow-sm">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Abandono no Checkout
          </span>
          <span className="block font-mono text-xl font-bold text-[#E16349]">
            {dados.taxaAbandonoCarrinho}%
          </span>
          <span className="mt-1 block text-[12px] font-medium leading-snug text-[#1A1A1A]">
            Clientes que iniciaram o preenchimento dos dados mas recuaram na Stripe.
          </span>
        </div>

        <div className="bg-white rounded-[16px] p-4 border border-zinc-200/80 shadow-sm">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Conversão Geral do Tráfego
          </span>
          <span 
            className={`block font-mono text-xl font-bold ${
              isConversaoSaudavel ? 'text-[#4A7856]' : 'text-zinc-700'
            }`}
          >
            {dados.taxaConversaoCardapio}%
          </span>
          <span className="mt-1 block text-[12px] font-medium leading-snug text-[#1A1A1A]">
            {isConversaoSaudavel 
              ? 'Performance excelente! O design e o produto superaram a média de mercado.' 
              : 'Média de mercado estável. Otimize os criativos do Meta Ads para atrair mais cliques.'}
          </span>
        </div>

      </div>
    </div>
  );
}
