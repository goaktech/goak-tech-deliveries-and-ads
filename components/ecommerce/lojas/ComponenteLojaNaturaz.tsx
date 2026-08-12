'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Sriracha } from 'next/font/google';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';

const fonteAssinatura = Sriracha({ subsets: ['latin'], weight: '400' });

interface ComponenteLojaNaturazProps {
  restaurante: { id: string; nome: string; endereco: string | null };
  produtos: ItemCardapio[];
}

const COR_LARANJA = '#E8532E';
const COR_VERDE_LIMAO = '#C4D92E';
const COR_VERDE_LIMAO_ESCURO = '#8FA317';
const COR_PRETO = '#1A1A1A';
const COR_CREME = '#FAF7EC';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function BlobLaranja() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <path
        d="M40,30 C110,-10 260,-5 330,45 C390,90 385,150 330,185 C260,225 100,225 45,180 C-5,140 -15,70 40,30 Z"
        fill={COR_LARANJA}
      />
    </svg>
  );
}

function AdesivoRosto() {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white shadow-md">
      <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden>
        <circle cx="32" cy="34" r="16" fill="none" stroke={COR_PRETO} strokeWidth="2" />
        <path d="M20,24 C22,12 42,12 44,24" fill="none" stroke={COR_PRETO} strokeWidth="2" strokeLinecap="round" />
        <circle cx="26" cy="33" r="1.6" fill={COR_PRETO} />
        <circle cx="38" cy="33" r="1.6" fill={COR_PRETO} />
        <path d="M25,41 Q32,46 39,41" fill="none" stroke={COR_PRETO} strokeWidth="2" strokeLinecap="round" />
        <circle cx="18" cy="38" r="2" fill="none" stroke={COR_PRETO} strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function SeloIngrediente({ texto }: { texto: string }) {
  return (
    <span className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-700">
      {texto}
    </span>
  );
}

interface CartaoProdutoNaturazProps {
  produto: ItemCardapio;
  expandido: boolean;
  onToggleExpandir: () => void;
}

function CartaoProdutoNaturaz({ produto, expandido, onToggleExpandir }: CartaoProdutoNaturazProps) {
  const { adicionarItem, itens, removerItem } = useCarrinho();
  const [complementosSelecionadosIds, setComplementosSelecionadosIds] = useState<string[]>([]);

  const complementosDisponiveis = (produto.complementos_produto || []).filter((c) => c.disponivel);

  const complementosSelecionados = complementosDisponiveis
    .filter((c) => complementosSelecionadosIds.includes(c.id))
    .map<Complemento>((c) => ({
      id: c.id,
      item_cardapio_id: c.item_cardapio_id || produto.id,
      nome: c.nome,
      preco_adicional: Number(c.preco_adicional),
      disponivel: c.disponivel,
      grupo: c.grupo ?? null,
    }));

  const idsOrdenados = complementosSelecionados.map((c) => c.id).sort().join('-');
  const idUnicoCarrinho = idsOrdenados ? `${produto.id}-${idsOrdenados}` : produto.id;
  const itemNoCarrinho = itens.find((item) => item.idUnico === idUnicoCarrinho);
  const qtd = itemNoCarrinho?.quantidade || 0;

  const valorComplementos = complementosSelecionados.reduce((acc, c) => acc + Number(c.preco_adicional), 0);
  const temComplementos = complementosDisponiveis.length > 0;

  const togglePill = (id: string) => {
    setComplementosSelecionadosIds((atuais) =>
      atuais.includes(id) ? atuais.filter((itemId) => itemId !== id) : [...atuais, id]
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-300">
      <button
        type="button"
        onClick={temComplementos ? onToggleExpandir : undefined}
        className={`flex w-full items-center gap-4 p-4 text-left transition-colors ${
          expandido ? 'bg-[#F4F8DC]' : temComplementos ? 'hover:bg-zinc-50' : ''
        }`}
      >
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#F4F8DC]">
          {produto.imagem_url ? (
            <Image src={produto.imagem_url} alt={produto.nome} width={64} height={64} className="h-full w-full object-cover" unoptimized />
          ) : (
            <span className="text-2xl" aria-hidden>🥗</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-extrabold" style={{ color: COR_LARANJA }}>{produto.nome}</h3>
          <p className="mt-0.5 truncate text-xs text-zinc-400">{produto.descricao || 'Fresquinho, preparado na hora.'}</p>
          <span className="mt-1 block font-mono text-sm font-extrabold text-zinc-900">
            {formatarMoeda(Number(produto.preco_venda))}
          </span>
        </div>

        {temComplementos ? (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
            style={{ backgroundColor: expandido ? COR_PRETO : COR_VERDE_LIMAO }}
          >
            <svg
              className={`h-4 w-4 transform transition-transform duration-200 ${expandido ? 'rotate-180 text-white' : 'text-zinc-900'}`}
              fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        ) : null}
      </button>

      {expandido && temComplementos && (
        <div className="animate-in fade-in space-y-4 border-t border-zinc-100 bg-white p-4 duration-200">
          <div className="space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: COR_VERDE_LIMAO_ESCURO }}>
              Adicionais
            </span>
            <div className="grid grid-cols-2 gap-2">
              {complementosDisponiveis.map((complemento) => {
                const selecionado = complementosSelecionadosIds.includes(complemento.id);
                return (
                  <button
                    key={complemento.id}
                    type="button"
                    onClick={() => togglePill(complemento.id)}
                    className="rounded-2xl border-2 px-3 py-2 text-center transition-all"
                    style={
                      selecionado
                        ? { backgroundColor: COR_PRETO, borderColor: COR_PRETO, color: '#fff' }
                        : { backgroundColor: '#fff', borderColor: '#EDEDE5', color: '#3f3f46' }
                    }
                  >
                    <span className="block truncate text-[11px] font-bold leading-tight">{complemento.nome}</span>
                    <span className={`mt-0.5 block text-[10px] ${selecionado ? 'text-white/80' : 'text-zinc-400'}`}>
                      +{formatarMoeda(Number(complemento.preco_adicional))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
            <div className="text-xs font-semibold text-zinc-500">
              {complementosSelecionados.length > 0 ? (
                <>Adicionais <span className="font-mono">+{formatarMoeda(valorComplementos)}</span></>
              ) : (
                'Quantidade'
              )}
            </div>
            <SeletorQuantidade qtd={qtd} idUnicoCarrinho={idUnicoCarrinho} produto={produto} complementosSelecionados={complementosSelecionados} onAdicionar={adicionarItem} onRemover={removerItem} />
          </div>
        </div>
      )}

      {!temComplementos && (
        <div className="flex items-center justify-end px-4 pb-4">
          <SeletorQuantidade qtd={qtd} idUnicoCarrinho={idUnicoCarrinho} produto={produto} complementosSelecionados={complementosSelecionados} onAdicionar={adicionarItem} onRemover={removerItem} />
        </div>
      )}
    </div>
  );
}

interface SeletorQuantidadeProps {
  qtd: number;
  idUnicoCarrinho: string;
  produto: ItemCardapio;
  complementosSelecionados: Complemento[];
  onAdicionar: (produto: ItemCardapio, complementos: Complemento[]) => void;
  onRemover: (idUnico: string) => void;
}

function SeletorQuantidade({ qtd, idUnicoCarrinho, produto, complementosSelecionados, onAdicionar, onRemover }: SeletorQuantidadeProps) {
  if (qtd > 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border-2 border-zinc-100 bg-white p-1">
        <button
          type="button"
          onClick={() => onRemover(idUnicoCarrinho)}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-50 text-sm font-bold text-zinc-600 hover:bg-zinc-100"
        >
          -
        </button>
        <span className="px-0.5 font-mono text-sm font-bold text-zinc-800">{qtd}</span>
        <button
          type="button"
          onClick={() => onAdicionar(produto, complementosSelecionados)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: COR_PRETO }}
        >
          +
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onAdicionar(produto, complementosSelecionados)}
      className="rounded-xl px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider text-zinc-900 shadow-sm transition-all"
      style={{ backgroundColor: COR_VERDE_LIMAO }}
    >
      Adicionar
    </button>
  );
}

export default function ComponenteLojaNaturaz({ restaurante, produtos }: ComponenteLojaNaturazProps) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens } = useCarrinho();
  const [produtoExpandidoId, setProdutoExpandidoId] = useState<string | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<'BOWLS' | 'SALADAS' | 'WRAPS' | 'SNACKS' | 'SUCOS'>('BOWLS');

  const alternarExpandido = (produtoId: string) => {
    setProdutoExpandidoId((atual) => (atual === produtoId ? null : produtoId));
  };

  const categoriaDoProduto = (nome: string) => {
    if (/bowl/i.test(nome)) return 'BOWLS';
    if (/salada/i.test(nome)) return 'SALADAS';
    if (/wrap/i.test(nome)) return 'WRAPS';
    if (/energy ball|castanha|chips/i.test(nome)) return 'SNACKS';
    if (/suco|vitamina|água de coco/i.test(nome)) return 'SUCOS';
    return 'BOWLS';
  };

  const produtosFiltrados = produtos.filter((produto) => categoriaDoProduto(produto.nome) === categoriaAtiva);

  return (
    <div className="min-h-screen antialiased pb-32 font-sans select-none" style={{ backgroundColor: COR_CREME }}>
      <div className="relative w-full overflow-hidden pb-8" style={{ backgroundColor: COR_CREME }}>
        <header className="relative z-10 mx-auto flex w-full max-w-xl items-center justify-between px-6 pt-6">
          <button className="text-zinc-900/70 transition-colors hover:text-zinc-900">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href={`/${slug}/checkout`} className="relative text-zinc-900/70 transition-colors hover:text-zinc-900" aria-label="Ver sacola">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
            </svg>
            {totalItens > 0 && (
              <span
                className="absolute -top-2 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none text-white"
                style={{ backgroundColor: COR_LARANJA }}
              >
                {totalItens}
              </span>
            )}
          </Link>
        </header>

        <div className="relative z-10 mx-auto mt-4 w-full max-w-xl px-6">
          <div className="relative flex min-h-[150px] items-center justify-center">
            <BlobLaranja />
            <h1
              className={`${fonteAssinatura.className} relative z-10 text-center text-6xl leading-[0.85] sm:text-7xl`}
              style={{ color: COR_CREME }}
            >
              naturaz
            </h1>
            <div className="absolute -right-1 -top-2 z-20">
              <AdesivoRosto />
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-3 flex w-full max-w-xl flex-wrap items-center justify-center gap-2 px-6">
          <SeloIngrediente texto="Sem Açúcar" />
          <SeloIngrediente texto="Sem Glúten" />
          <SeloIngrediente texto="100% Natural" />
        </div>

        <div className="relative z-10 mx-auto mt-3 flex w-full max-w-xl flex-col items-center gap-1.5 px-6">
          <span className="h-px w-24" style={{ backgroundColor: COR_CREME }} />
          <span className="h-px w-24" style={{ backgroundColor: COR_CREME }} />
        </div>
      </div>

      <div className="mx-auto mt-6 w-full max-w-xl px-6">
        <nav className="mb-5 flex items-center gap-2 overflow-x-auto text-xs font-extrabold scrollbar-none">
          {(
            [
              { chave: 'BOWLS', rotulo: 'Bowls' },
              { chave: 'SALADAS', rotulo: 'Saladas' },
              { chave: 'WRAPS', rotulo: 'Wraps' },
              { chave: 'SNACKS', rotulo: 'Snacks' },
              { chave: 'SUCOS', rotulo: 'Sucos' },
            ] as const
          ).map((aba) => (
            <button
              key={aba.chave}
              type="button"
              onClick={() => setCategoriaAtiva(aba.chave)}
              className="shrink-0 rounded-2xl px-4 py-2 uppercase tracking-wide transition-colors"
              style={
                categoriaAtiva === aba.chave
                  ? { backgroundColor: COR_PRETO, color: COR_VERDE_LIMAO }
                  : { backgroundColor: '#fff', color: '#57534e', border: '2px solid #EDEDE5' }
              }
            >
              {aba.rotulo}
            </button>
          ))}
        </nav>

        <div className="space-y-3">
          {produtosFiltrados.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-zinc-200 bg-white py-16 text-center text-zinc-400 shadow-sm">
              <p className="text-xs font-bold">Nada por aqui ainda — confira as outras abas.</p>
            </div>
          ) : (
            produtosFiltrados.map((produto) => (
              <CartaoProdutoNaturaz
                key={produto.id}
                produto={produto}
                expandido={produtoExpandidoId === produto.id}
                onToggleExpandir={() => alternarExpandido(produto.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="mx-auto mt-6 w-full max-w-xl px-6 text-center text-[11px] text-zinc-400">
        {restaurante.endereco?.trim() || 'Endereço do estabelecimento'}
      </div>

      <BarraCarrinhoFlutuante corBotaoAcao={COR_PRETO} corBadgeFundo={COR_VERDE_LIMAO} corBadgeTexto={COR_PRETO} />
    </div>
  );
}
