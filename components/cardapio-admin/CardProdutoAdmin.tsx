'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ItemCardapioComCMV } from '@/actions/admin';

interface CardProps {
  produto: ItemCardapioComCMV;
  isSelecionado: boolean;
  onToggleSelect: () => void;
  onAlternarStatus: () => void;
  onExcluir: () => void;
  onEditar: () => void;
  onMoverParaCima: () => void;
  onMoverParaBaixo: () => void;
  podeSubir: boolean;
  podeDescer: boolean;
  isPending?: boolean;
}

export default function CardProdutoAdmin({
  produto,
  isSelecionado,
  onToggleSelect,
  onAlternarStatus,
  onExcluir,
  onEditar,
  onMoverParaCima,
  onMoverParaBaixo,
  podeSubir,
  podeDescer,
  isPending = false,
}: CardProps) {
  const cmvCritico = produto.percentual_cmv > 40;
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  const miniaturaProduto = (tamanhoIcone: string) => (
    produto.imagem_url ? (
      <Image
        src={produto.imagem_url}
        alt={produto.nome}
        width={64}
        height={64}
        unoptimized
        className="h-full w-full object-cover"
      />
    ) : (
      <svg className={`${tamanhoIcone} text-zinc-300`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 12.75h.008v.008H18v-.008zM4.5 20.25h15a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25z" />
      </svg>
    )
  );

  const badgeEAcoes = (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onAlternarStatus}
        disabled={isPending}
        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide transition disabled:opacity-60 ${
          produto.disponivel
            ? 'border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
        }`}
      >
        {produto.disponivel ? 'Ativo' : 'Pausado'}
      </button>
      <button
        type="button"
        onClick={onEditar}
        disabled={isPending}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-60"
        aria-label={`Editar ${produto.nome}`}
        title="Editar item"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onExcluir}
        disabled={isPending}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-60"
        aria-label={`Apagar ${produto.nome}`}
        title="Apagar item"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2m-7 4v8m6-8v8M5 6l1 14h12l1-14" />
        </svg>
      </button>
    </div>
  );

  const composicao = (
    <div className="max-w-md space-y-1 rounded-xl border border-zinc-200/70 bg-white p-3">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Composição</span>
      {produto.ingredientes.map((ing, i) => (
        <div key={i} className="flex items-center justify-between text-[11px] font-medium text-zinc-600">
          <span>• {ing.nome}</span>
          <span className="text-zinc-400">{ing.quantidade}{ing.unidade}</span>
        </div>
      ))}
    </div>
  );

  const botaoToggleDetalhes = (classeExtra: string) => (
    <button
      type="button"
      onClick={() => setDetalhesAbertos((atual) => !atual)}
      className={`flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 ${classeExtra}`}
      aria-expanded={detalhesAbertos}
    >
      <span>Custo, CMV e margem</span>
      <svg className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${detalhesAbertos ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </button>
  );

  const setasOrdenacao = (tamanhoBotao: string, tamanhoIcone: string) => (
    <div className="flex shrink-0 flex-col gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1" role="group" aria-label={`Reordenar ${produto.nome}`}>
      <button
        type="button"
        onClick={onMoverParaCima}
        disabled={isPending || !podeSubir}
        className={`flex ${tamanhoBotao} items-center justify-center rounded-md bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-100 hover:text-[#E16349] disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none disabled:hover:bg-white disabled:hover:text-zinc-700`}
        aria-label={`Mover ${produto.nome} para cima`}
        title="Mover para cima no cardápio"
      >
        <svg className={tamanhoIcone} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onMoverParaBaixo}
        disabled={isPending || !podeDescer}
        className={`flex ${tamanhoBotao} items-center justify-center rounded-md bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-100 hover:text-[#E16349] disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none disabled:hover:bg-white disabled:hover:text-zinc-700`}
        aria-label={`Mover ${produto.nome} para baixo`}
        title="Mover para baixo no cardápio"
      >
        <svg className={tamanhoIcone} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>
  );

  return (
    <div className={`group flex flex-col gap-5 rounded-2xl border p-5 transition-all lg:flex-row lg:items-start lg:justify-between lg:gap-4 ${
      isSelecionado ? 'border-[#E16349]/25 bg-orange-50/30' : 'border-zinc-200/50 bg-zinc-50/40 hover:border-zinc-300 hover:bg-white'
    }`}>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:hidden">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200/70 bg-white">
            {miniaturaProduto('h-5 w-5')}
          </div>
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight text-[#1A1A1A] transition-colors group-hover:text-[#E16349]">{produto.nome}</h3>
          <input
            type="checkbox"
            checked={isSelecionado}
            onChange={onToggleSelect}
            className="mt-1 w-4 h-4 shrink-0 rounded-md border-zinc-300 text-[#E16349] cursor-pointer accent-[#E16349]"
          />
        </div>

        {badgeEAcoes}
        <p className="max-w-md truncate text-xs font-medium text-zinc-500">{produto.descricao || 'Sem descrição.'}</p>
        {composicao}

        <div className="flex items-center gap-2">
          {setasOrdenacao('h-6 w-6', 'h-3.5 w-3.5')}
          {botaoToggleDetalhes('flex-1')}
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 items-start gap-4 sm:flex">
        {setasOrdenacao('h-7 w-7', 'h-4 w-4')}

        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200/70 bg-white">
          {miniaturaProduto('h-6 w-6')}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <h3 className="truncate text-base font-semibold leading-tight text-[#1A1A1A] transition-colors group-hover:text-[#E16349]">{produto.nome}</h3>
          {badgeEAcoes}
          <p className="max-w-md truncate text-xs font-medium text-zinc-500">{produto.descricao || 'Sem descrição.'}</p>
          {composicao}
          {botaoToggleDetalhes('w-full lg:hidden')}
        </div>

        <input
          type="checkbox"
          checked={isSelecionado}
          onChange={onToggleSelect}
          aria-label={`Selecionar ${produto.nome}`}
          className="w-4 h-4 shrink-0 rounded-md border-zinc-300 text-[#E16349] mt-1.5 cursor-pointer accent-[#E16349] lg:hidden"
        />
      </div>

      <div className={`${detalhesAbertos ? 'grid grid-cols-3 sm:flex sm:items-center sm:gap-8' : 'hidden'} gap-4 self-center border-t border-zinc-200 pt-3 text-zinc-500 lg:flex lg:items-center lg:gap-8 lg:border-t-0 lg:pt-0`}>
        <div className="text-left sm:text-right min-w-[70px]">
          <span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Custo</span>
          <span className="text-xs font-semibold text-zinc-700 sm:text-sm">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.custo_producao)}</span>
        </div>
        <div className="text-left sm:text-right min-w-[65px]">
          <span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-400">CMV %</span>
          <span className={`text-xs font-semibold sm:text-sm ${cmvCritico ? 'text-red-500' : 'text-zinc-700'}`}>{produto.percentual_cmv.toFixed(1)}%</span>
        </div>
        <div className="text-left sm:text-right min-w-[75px]">
          <span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Margem</span>
          <span className="text-xs font-semibold text-emerald-600 sm:text-sm">+{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.margem_lucro)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end shrink-0 self-center sm:pl-4">
        <div className="text-left sm:text-right">
          <span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Venda</span>
          <span className="text-sm font-bold text-[#1A1A1A] sm:text-base">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(produto.preco_venda))}</span>
        </div>
      </div>

      <input
        type="checkbox"
        checked={isSelecionado}
        onChange={onToggleSelect}
        aria-label={`Selecionar ${produto.nome}`}
        className="hidden w-4 h-4 shrink-0 self-start rounded-md border-zinc-300 text-[#E16349] cursor-pointer accent-[#E16349] lg:block"
      />
    </div>
  );
}
