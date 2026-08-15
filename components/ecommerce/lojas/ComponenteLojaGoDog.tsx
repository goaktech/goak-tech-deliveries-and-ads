'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';
import { ehBebida, obterConfigLojaEspecial } from '@/utils/config-lojas-especiais';

interface ComponenteLojaGoDogProps {
  restaurante: { id: string; nome: string; endereco: string | null };
  produtos: ItemCardapio[];
}

const COR_PRIMARIA = '#C1272D';
const COR_ACENTO = '#F4B41A';

// Deixe em `false` para ocultar o aviso de promoção de inauguração sem
// precisar remover o bloco do código.
const MOSTRAR_PROMO_INAUGURACAO = true;

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function IconeHamburguer({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 9.5C4 6.5 7.6 4 12 4s8 2.5 8 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M3.2 11.2h17.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M3.6 14.3c1-0.9 2-0.9 3 0s2 0.9 3 0 2-0.9 3 0 2 0.9 3 0 2-0.9 3 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 17.2h17a1.3 1.3 0 010 2.6h-17a1.3 1.3 0 010-2.6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeSelo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      <path
        d="M12 3.4l1.72 1.06 2.02-.3.96 1.82 1.82.96-.3 2.02L19.28 10l-1.06 1.72.3 2.02-1.82.96-.96 1.82-2.02-.3L12 17.28l-1.72 1.06-2.02-.3-.96-1.82-1.82-.96.3-2.02L4.72 11.72 5.78 10l-.3-2.02 1.82-.96.96-1.82 2.02.3L12 3.4z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M9 11.6l1.9 1.9L15.2 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeBebida({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 3v3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M6.3 8h11.4l-1.15 10.3a2 2 0 01-1.99 1.78H9.44a2 2 0 01-1.99-1.78L6.3 8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M6.9 11h10.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

interface CartaoItemGoDogProps {
  produto: ItemCardapio;
  limiteUnidadesComida?: number;
}

function CartaoItemGoDog({ produto, limiteUnidadesComida }: CartaoItemGoDogProps) {
  const { adicionarItem, itens, removerItem } = useCarrinho();
  const [sanfonaAberta, setSanfonaAberta] = useState(false);
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

  const adicionaisIds = complementosSelecionados.map((c) => c.id).sort().join('-');
  const idUnicoCarrinho = adicionaisIds ? `${produto.id}-${adicionaisIds}` : produto.id;
  const itemNoCarrinho = itens.find((item) => item.idUnico === idUnicoCarrinho);
  const qtd = itemNoCarrinho?.quantidade || 0;

  const produtoEhComida = !ehBebida(produto.nome);
  const totalComidaNoCarrinho = itens
    .filter((item) => !ehBebida(item.produto.nome))
    .reduce((acc, item) => acc + item.quantidade, 0);
  const limiteComidaAtingido = Boolean(
    limiteUnidadesComida && produtoEhComida && totalComidaNoCarrinho >= limiteUnidadesComida
  );

  const valorComplementosSelecionados = complementosSelecionados.reduce(
    (acc, c) => acc + Number(c.preco_adicional),
    0
  );

  const toggleComplemento = (id: string) => {
    setComplementosSelecionadosIds((atuais) =>
      atuais.includes(id) ? atuais.filter((itemId) => itemId !== id) : [...atuais, id]
    );
  };

  const emoji = ehBebida(produto.nome) ? '🥤' : '🌭';

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden transition-all">
      <div
        onClick={() => setSanfonaAberta(!sanfonaAberta)}
        className="p-4 flex gap-4 items-start cursor-pointer select-none hover:bg-zinc-50/80 transition-colors"
      >
        <div className="w-[88px] h-[88px] rounded-xl flex items-center justify-center flex-shrink-0 bg-[#FCEFD2] text-amber-700 shadow-inner overflow-hidden">
          {produto.imagem_url ? (
            <Image
              src={produto.imagem_url}
              alt={`Foto do produto ${produto.nome}`}
              className="w-full h-full object-cover"
              width={72}
              height={72}
              loading="lazy"
              unoptimized
            />
          ) : (
            <span className="text-3xl">{emoji}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-zinc-900 text-base leading-tight break-words">
            {produto.nome}
          </h3>
          <p className="text-zinc-500 text-xs mt-1 leading-relaxed break-words">
            {produto.descricao || 'Preparado na hora, com ingredientes selecionados.'}
          </p>
          <span className="font-bold text-[24px] block mt-2 leading-none" style={{ color: COR_PRIMARIA }}>
            {formatarMoeda(Number(produto.preco_venda))}
          </span>
        </div>

        <div className="shrink-0 p-1 mt-1" style={{ color: COR_PRIMARIA }}>
          <svg
            className={`w-6 h-6 transform transition-transform duration-200 ${sanfonaAberta ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {sanfonaAberta && (
        <div className="border-t border-zinc-200 bg-white p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex justify-between items-center select-none">
            <span className="text-xs font-medium text-zinc-600">Adicionais</span>
            {qtd > 0 && (
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                Item na sacola
              </span>
            )}
          </div>

          <div className="space-y-2">
            {complementosDisponiveis.length === 0 ? (
              <div className="bg-white border border-zinc-200/60 rounded-xl p-3 text-[11px] text-zinc-500">
                Este item não possui complementos no momento.
              </div>
            ) : (
              complementosDisponiveis.map((complemento) => {
                const selecionado = complementosSelecionadosIds.includes(complemento.id);
                return (
                  <label
                    key={complemento.id}
                    className={`w-full bg-white border rounded-xl p-3 flex justify-between items-center shadow-2xs transition-all ${
                      selecionado ? 'border-[#C1272D]' : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={() => toggleComplemento(complemento.id)}
                        className="h-5 w-5 accent-[#C1272D] rounded border-zinc-300"
                      />
                      <div className="text-left min-w-0">
                        <span className="text-xs font-medium text-zinc-800 block truncate">{complemento.nome}</span>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-700">
                      {formatarMoeda(Number(complemento.preco_adicional))}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {complementosSelecionados.length > 0 && (
            <div className="text-xs text-zinc-600 flex justify-between">
              <span>Complementos selecionados</span>
              <span className="font-mono">+{formatarMoeda(valorComplementosSelecionados)}</span>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2 items-end border-t border-zinc-100">
            <div className="w-full flex justify-between items-center">
              <span className="text-xs text-zinc-600">Quantidade</span>
              {qtd > 0 ? (
                <div className="flex items-center bg-zinc-100 border border-zinc-200/60 rounded-xl p-0.5 gap-2.5">
                  <button
                    type="button"
                    onClick={() => removerItem(idUnicoCarrinho)}
                    className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-sm font-semibold text-zinc-600 hover:bg-zinc-200 shadow-2xs transition-colors"
                  >
                    -
                  </button>
                  <span className="text-sm px-0.5 text-zinc-800 font-mono">{qtd}</span>
                  <button
                    type="button"
                    disabled={limiteComidaAtingido}
                    onClick={() => adicionarItem(produto, complementosSelecionados)}
                    className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center text-sm font-semibold text-white hover:bg-zinc-800 shadow-2xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-900"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={limiteComidaAtingido}
                  onClick={() => adicionarItem(produto, complementosSelecionados)}
                  className="text-zinc-900 font-semibold text-sm px-6 py-2.5 rounded-xl transition-all tracking-wide border disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: COR_ACENTO, borderColor: '#D9A014' }}
                >
                  Adicionar à sacola
                </button>
              )}
            </div>

            {limiteComidaAtingido && (
              <p className="text-[11px] text-right text-[#C1272D] font-medium leading-snug">
                Limite de {limiteUnidadesComida} cachorros-quentes por pedido atingido.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComponenteLojaGoDog({ restaurante, produtos }: ComponenteLojaGoDogProps) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens } = useCarrinho();
  const [categoriaAtiva, setCategoriaAtiva] = useState<'DOGS' | 'BEBIDAS'>('DOGS');
  const configLoja = obterConfigLojaEspecial(slug);

  const produtosFiltrados = produtos.filter((produto) =>
    categoriaAtiva === 'BEBIDAS' ? ehBebida(produto.nome) : !ehBebida(produto.nome)
  );

  const formatarMoedaTaxa = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="min-h-screen w-full bg-white text-[#1A1A1A] antialiased font-sans select-none">
      <div className="w-full max-w-xl mx-auto min-h-screen bg-[#F4F4F4] border-x border-zinc-200/40 pb-32">
        <div className="w-full text-white shadow-md" style={{ backgroundColor: COR_PRIMARIA }}>
          <header className="w-full px-6 py-4 flex items-center justify-between">
            <div className="leading-tight">
              <h1 className="font-bold text-lg tracking-tight">{restaurante.nome}</h1>
              <span className="text-[9px] font-medium tracking-[0.12em] uppercase" style={{ color: COR_ACENTO }}>
                {restaurante.endereco?.trim() || 'Endereço do estabelecimento'}
              </span>
            </div>
            <Link href={`/${slug}/checkout`} className="relative p-1" aria-label="Ver sacola">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
              </svg>
              {totalItens > 0 && (
                <span
                  className="absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center leading-none border shadow-sm"
                  style={{ backgroundColor: COR_ACENTO, color: COR_PRIMARIA, borderColor: 'rgba(193,39,45,0.2)' }}
                >
                  {totalItens}
                </span>
              )}
            </Link>
          </header>
        </div>

        <div className="w-full border-b" style={{ backgroundColor: COR_ACENTO, borderColor: '#D9A014' }}>
          <nav className="w-full px-6 py-3 flex items-center gap-3 text-xs font-medium text-zinc-900 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setCategoriaAtiva('DOGS')}
              className="px-5 py-2 rounded-xl flex items-center gap-2 shadow-sm shrink-0 transition-colors"
              style={
                categoriaAtiva === 'DOGS'
                  ? { backgroundColor: COR_PRIMARIA, color: '#fff' }
                  : { backgroundColor: 'transparent', color: '#1A1A1A' }
              }
            >
              <IconeHamburguer className="w-4 h-4" />
              <span>Cachorro-quente</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoriaAtiva('BEBIDAS')}
              className="px-5 py-2 rounded-xl flex items-center gap-2 shrink-0 transition-colors"
              style={
                categoriaAtiva === 'BEBIDAS'
                  ? { backgroundColor: COR_PRIMARIA, color: '#fff' }
                  : { backgroundColor: 'transparent', color: '#1A1A1A' }
              }
            >
              <IconeBebida className="w-4 h-4" />
              <span>Bebidas</span>
            </button>
          </nav>
        </div>

        {MOSTRAR_PROMO_INAUGURACAO && (
          <div className="w-full px-6 pt-4">
            <div
              className="rounded-2xl border p-4 text-white shadow-md"
              style={{ backgroundColor: COR_PRIMARIA, borderColor: '#8f1d22' }}
            >
              <div className="flex items-center gap-2">
                <IconeSelo className="w-4 h-4 shrink-0" style={{ color: COR_ACENTO }} />
                <span
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: COR_ACENTO }}
                >
                  Promoção de inauguração
                </span>
              </div>
              <p className="text-sm font-semibold leading-relaxed mt-1.5">
                Estamos comemorando a abertura da GoDog com preços especiais por tempo limitado! Corra e aproveite!
              </p>
            </div>
          </div>
        )}

        {configLoja.taxaEntregaFixa > 0 && (
          <div className="w-full px-6 pt-3">
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M4.93 4.93l14.14 14.14M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs font-medium leading-relaxed">
                Ainda não trabalhamos com retirada no local. Uma taxa de entrega de {formatarMoedaTaxa(configLoja.taxaEntregaFixa)} é adicionada no checkout.
              </p>
            </div>
          </div>
        )}

        <div className="w-full px-6 mt-6">
          <div className="flex flex-col gap-1 mb-4 select-none">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Cardápio</span>
          </div>

          <div className="space-y-4">
            {produtosFiltrados.length === 0 ? (
              <div className="text-center py-16 text-zinc-400 bg-white rounded-2xl border border-zinc-200/60 shadow-sm">
                <p className="text-xs">Nada por aqui ainda — confira a outra aba.</p>
              </div>
            ) : (
              produtosFiltrados.map((produto) => (
                <CartaoItemGoDog
                  key={produto.id}
                  produto={produto}
                  limiteUnidadesComida={configLoja.limiteUnidadesComida}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <BarraCarrinhoFlutuante corBotaoAcao={COR_PRIMARIA} corBadgeFundo={COR_ACENTO} corBadgeTexto={COR_PRIMARIA} />
    </div>
  );
}
