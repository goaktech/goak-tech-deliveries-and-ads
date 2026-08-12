'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';

interface ComponenteLojaGeovannaAcaiteriaProps {
  restaurante: { id: string; nome: string; endereco: string | null };
  produtos: ItemCardapio[];
}

const COR_ROXO = '#3B0D2C';
const COR_CORAL = '#E16349';
const COR_CORAL_ESCURO = '#D1543B';
const COR_FUNDO_PAGINA = '#FDF6F3';
const NOME_GRUPO_COBERTURAS = 'Coberturas';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface CartaoProdutoGeovannaProps {
  produto: ItemCardapio;
  expandido: boolean;
  onToggleExpandir: () => void;
}

function CartaoProdutoGeovanna({ produto, expandido, onToggleExpandir }: CartaoProdutoGeovannaProps) {
  const { adicionarItem, itens, removerItem } = useCarrinho();
  const [complementosSelecionadosIds, setComplementosSelecionadosIds] = useState<string[]>([]);

  const complementosDisponiveis = (produto.complementos_produto || []).filter((c) => c.disponivel);
  const adicionais = complementosDisponiveis.filter((c) => c.grupo !== NOME_GRUPO_COBERTURAS);
  const coberturas = complementosDisponiveis.filter((c) => c.grupo === NOME_GRUPO_COBERTURAS);

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

  const togglePill = (id: string) => {
    setComplementosSelecionadosIds((atuais) =>
      atuais.includes(id) ? atuais.filter((itemId) => itemId !== id) : [...atuais, id]
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden transition-all duration-300">
      <button
        type="button"
        onClick={onToggleExpandir}
        className={`w-full p-4 flex items-center gap-4 text-left transition-colors ${
          expandido ? 'bg-[#FBEAEE]' : 'hover:bg-zinc-50'
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-[#F9ECEF] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-inner">
          {produto.imagem_url ? (
            <Image src={produto.imagem_url} alt={produto.nome} width={64} height={64} className="w-full h-full object-cover" unoptimized />
          ) : (
            <span className="text-2xl" aria-hidden>🍇</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-zinc-900 text-sm truncate">{produto.nome}</h3>
          <p className="text-zinc-400 text-xs mt-0.5 truncate">{produto.descricao || 'Açaí montado na hora.'}</p>
          <span className="mt-1 block font-bold text-sm font-mono" style={{ color: COR_CORAL }}>
            {formatarMoeda(Number(produto.preco_venda))}
          </span>
        </div>

        <div
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: expandido ? COR_ROXO : COR_CORAL }}
        >
          <svg
            className={`w-4 h-4 text-white transform transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {expandido && (
        <div className="border-t border-zinc-100 bg-white p-4 space-y-5 animate-in fade-in duration-200">
          {adicionais.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5" style={{ color: COR_CORAL }}>
                <span className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px] leading-none" style={{ borderColor: COR_CORAL }} aria-hidden>+</span>
                <span className="text-[11px] font-bold uppercase tracking-wider">Adicionais</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {adicionais.map((complemento) => {
                  const selecionado = complementosSelecionadosIds.includes(complemento.id);
                  return (
                    <button
                      key={complemento.id}
                      type="button"
                      onClick={() => togglePill(complemento.id)}
                      className="rounded-2xl border px-3 py-2 text-center transition-all"
                      style={
                        selecionado
                          ? { backgroundColor: COR_ROXO, borderColor: COR_ROXO, color: '#fff' }
                          : { backgroundColor: '#fff', borderColor: '#F0DDE2', color: '#3f3f46' }
                      }
                    >
                      <span className="block text-[11px] font-semibold leading-tight truncate">{complemento.nome}</span>
                      <span className={`block text-[10px] mt-0.5 ${selecionado ? 'text-white/80' : 'text-zinc-400'}`}>
                        +{formatarMoeda(Number(complemento.preco_adicional))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {coberturas.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5" style={{ color: COR_CORAL }}>
                <span aria-hidden className="text-xs">🍓</span>
                <span className="text-[11px] font-bold uppercase tracking-wider">Coberturas</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {coberturas.map((complemento) => {
                  const selecionado = complementosSelecionadosIds.includes(complemento.id);
                  return (
                    <button
                      key={complemento.id}
                      type="button"
                      onClick={() => togglePill(complemento.id)}
                      className="rounded-full border px-4 py-1.5 text-[11px] font-semibold transition-all"
                      style={
                        selecionado
                          ? { backgroundColor: COR_ROXO, borderColor: COR_ROXO, color: '#fff' }
                          : { backgroundColor: '#fff', borderColor: '#F0DDE2', color: '#3f3f46' }
                      }
                    >
                      {complemento.nome}
                      <span className={selecionado ? 'text-white/70' : 'text-zinc-400'}> +{formatarMoeda(Number(complemento.preco_adicional))}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-3 flex items-center justify-between border-t border-zinc-100">
            <div className="text-xs font-semibold text-zinc-500">
              {complementosSelecionados.length > 0 ? (
                <>Adicionais <span className="font-mono">+{formatarMoeda(valorComplementos)}</span></>
              ) : (
                'Quantidade'
              )}
            </div>
            {qtd > 0 ? (
              <div className="flex items-center bg-zinc-50 rounded-xl p-1 gap-2.5 border border-zinc-200/60">
                <button
                  type="button"
                  onClick={() => removerItem(idUnicoCarrinho)}
                  className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-sm font-bold text-zinc-600 hover:bg-zinc-100 shadow-sm"
                >
                  -
                </button>
                <span className="text-sm font-bold px-0.5 text-zinc-800 font-mono">{qtd}</span>
                <button
                  type="button"
                  onClick={() => adicionarItem(produto, complementosSelecionados)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-sm"
                  style={{ backgroundColor: COR_ROXO }}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => adicionarItem(produto, complementosSelecionados)}
                className="text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: COR_CORAL }}
              >
                Adicionar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComponenteLojaGeovannaAcaiteria({ restaurante, produtos }: ComponenteLojaGeovannaAcaiteriaProps) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens, valorTotal } = useCarrinho();
  const [produtoExpandidoId, setProdutoExpandidoId] = useState<string | null>(produtos[0]?.id ?? null);

  const alternarExpandido = (produtoId: string) => {
    setProdutoExpandidoId((atual) => (atual === produtoId ? null : produtoId));
  };

  return (
    <div className="min-h-screen antialiased pb-32 font-sans select-none" style={{ backgroundColor: COR_FUNDO_PAGINA }}>
      <div className="relative w-full text-white" style={{ backgroundColor: COR_ROXO }}>
        <header className="w-full max-w-xl mx-auto px-6 pt-6 pb-9 flex items-center justify-between">
          <button className="text-white/80 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="text-center leading-tight">
            <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base">
              🍇
            </div>
            <h1 className="font-extrabold text-lg tracking-tight uppercase text-white">Geovanna</h1>
            <span className="text-[10px] font-bold tracking-[0.3em] block uppercase" style={{ color: COR_CORAL }}>
              · Açaiteria ·
            </span>
          </div>

          <Link href={`/${slug}/checkout`} className="relative text-white/80 hover:text-white transition-colors" aria-label="Ver sacola">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
            </svg>
            {totalItens > 0 && (
              <span
                className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center leading-none"
                style={{ backgroundColor: COR_CORAL }}
              >
                {totalItens}
              </span>
            )}
          </Link>
        </header>

        <svg
          className="absolute bottom-0 left-0 w-full h-6"
          viewBox="0 0 400 32"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0,32 C100,0 300,0 400,32 L400,32 L0,32 Z" fill={COR_FUNDO_PAGINA} />
        </svg>
      </div>

      <div className="w-full max-w-xl mx-auto px-6 mt-2">
        <div className="flex items-center gap-2 mb-1 select-none">
          <span className="text-lg" aria-hidden>🥣</span>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-zinc-900">Nossos açaís</h2>
        </div>
        <p className="text-xs text-zinc-500 mb-5">Monte seu açaí com adicionais e coberturas</p>

        <div className="space-y-4">
          {produtos.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 bg-white rounded-[24px] border border-zinc-200/60 shadow-sm">
              <p className="font-bold text-xs">O cardápio está sendo atualizado.</p>
            </div>
          ) : (
            produtos.map((produto) => (
              <CartaoProdutoGeovanna
                key={produto.id}
                produto={produto}
                expandido={produtoExpandidoId === produto.id}
                onToggleExpandir={() => alternarExpandido(produto.id)}
              />
            ))
          )}
        </div>
      </div>

      {totalItens > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-4 z-40 animate-in slide-in-from-bottom duration-300 select-none">
          <div className="max-w-md mx-auto rounded-[24px] p-4 flex items-center justify-between shadow-xl border bg-white/90 backdrop-blur-xl border-zinc-200/60">
            <div className="flex items-center gap-3.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs text-white shadow-sm"
                style={{ backgroundColor: COR_ROXO }}
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
              className="font-extrabold text-xs px-5 py-3 rounded-[16px] active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-md uppercase tracking-wider text-white"
              style={{ backgroundColor: COR_CORAL_ESCURO }}
            >
              Ver Sacola
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      <div className="w-full max-w-xl mx-auto px-6 mt-6 text-center text-[11px] text-zinc-400">
        {restaurante.endereco?.trim() || 'Endereço do estabelecimento'}
      </div>
    </div>
  );
}
