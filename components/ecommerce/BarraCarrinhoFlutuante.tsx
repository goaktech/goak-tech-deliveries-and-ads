'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCarrinho } from './ContextoCarrinho';

interface BarraProps {
  corBotaoAcao?: string;
  corBadgeFundo?: string;
  corBadgeTexto?: string;
}

export default function BarraCarrinhoFlutuante({
  corBotaoAcao = '#E52521',
  corBadgeFundo = '#F4F4F5',
  corBadgeTexto = '#27272A',
}: BarraProps) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens, valorTotal } = useCarrinho();

  if (totalItens === 0) return null;

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="fixed bottom-0 inset-x-0 p-4 bg-transparent z-40 animate-in slide-in-from-bottom duration-300 select-none">
      <div className="max-w-md mx-auto rounded-[24px] p-4 flex items-center justify-between shadow-xl border bg-white/80 border-zinc-200/60 shadow-zinc-300/40 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shadow-sm transition-colors font-mono"
            style={{ backgroundColor: corBadgeFundo, color: corBadgeTexto }}
          >
            {totalItens}
          </div>
          <div>
            <span className="text-[9px] block font-bold uppercase tracking-widest text-zinc-400">Subtotal</span>
            <span className="font-extrabold text-sm font-mono tracking-tight text-zinc-900">
              {formatarMoeda(valorTotal)}
            </span>
          </div>
        </div>

        <Link
          href={`/${slug}/checkout`}
          className="font-extrabold text-xs px-5 py-3 rounded-[16px] active:scale-[0.98] transition-all hover:brightness-90 flex items-center gap-1.5 shadow-md uppercase tracking-wider text-white"
          style={{ backgroundColor: corBotaoAcao }}
        >
          Ver Sacola
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
