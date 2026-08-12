'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ItemCardapio } from '@/types/database';
import CartaoItemCardapio from './CartaoItemCardapio';
import BarraCarrinhoFlutuante from './BarraCarrinhoFlutuante';
import { useCarrinho } from './ContextoCarrinho';

interface ComponenteLojaHamburguerProps {
  restaurante: { id: string; nome: string; endereco: string | null };
  produtos: ItemCardapio[];
}

export default function ComponenteLojaHamburguer({ restaurante, produtos }: ComponenteLojaHamburguerProps) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens } = useCarrinho();

  return (
    <div className="min-h-screen bg-[#F4F4F4] text-[#1A1A1A] antialiased pb-32 font-sans select-none">
      <div className="w-full bg-[#E52521] text-white shadow-md shadow-red-900/20">
        <header className="w-full max-w-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="text-white/90 hover:opacity-80">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="leading-tight">
              <h1 className="font-thin text-base tracking-tight uppercase">{restaurante.nome}</h1>
              <span className="text-[9px] font-thin tracking-[0.12em] text-[#FFC72C] uppercase">
                {restaurante.endereco?.trim() || 'Endereço do estabelecimento'}
              </span>
            </div>
          </div>
          <Link href={`/${slug}/checkout`} className="relative p-1" aria-label="Ver sacola">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
            </svg>
            {totalItens > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1 bg-[#FFC72C] text-[#E52521] rounded-full text-[10px] font-thin flex items-center justify-center leading-none border border-[#E52521]/20 shadow-sm">
                {totalItens}
              </span>
            )}
          </Link>
        </header>
      </div>

      <div className="w-full bg-[#FFC72C] border-b border-[#E9B31E]">
        <nav className="w-full max-w-xl mx-auto px-6 py-3 flex items-center gap-4 text-xs font-thin text-zinc-900 overflow-x-auto scrollbar-none">
          <button className="bg-[#E52521] text-white px-5 py-2 rounded-2xl flex items-center gap-2 shadow-sm shrink-0">
            <span aria-hidden>🍔</span>
            <span>Hambúrgueres</span>
          </button>
          <button className="opacity-80 hover:opacity-100 py-2 shrink-0">🥤 Bebidas</button>
          <button className="opacity-80 hover:opacity-100 py-2 shrink-0">🎟️ Combos</button>
        </nav>
      </div>

      <div className="w-full max-w-xl mx-auto px-6 mt-8">
        <div className="flex flex-col gap-1 mb-4 select-none">
          <span className="text-[10px] font-thin uppercase tracking-widest text-zinc-400">Cardápio</span>
        </div>

        <div className="space-y-4">
          {produtos.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 bg-white rounded-2xl border border-zinc-200/60 shadow-sm">
              <p className="font-thin text-xs">O cardápio está sendo atualizado.</p>
            </div>
          ) : (
            produtos.map((produto) => (
              <CartaoItemCardapio 
                key={produto.id} 
                produto={produto} 
              />
            ))
          )}
        </div>
      </div>

      <BarraCarrinhoFlutuante />
    </div>
  );
}
