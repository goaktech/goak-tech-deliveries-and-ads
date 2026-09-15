'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Archivo_Black } from 'next/font/google';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';

const fonteDestaque = Archivo_Black({ subsets: ['latin'], weight: '400' });

interface ComponenteLojaPeruchoBurguerProps {
  restaurante: { id: string; nome: string; endereco: string | null };
  produtos: ItemCardapio[];
}

const COR_FUNDO = '#F7F1E4';
const COR_TINTA = '#1C1815';
const COR_PRIMARIA = '#E8491D';
const COR_ACENTO = '#FFC93C';
const COR_CARTAO = '#FFFFFF';
const COR_MUTED = '#7A7168';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const SOMBRA_STICKER = `3px 3px 0 ${COR_TINTA}`;
const SOMBRA_STICKER_SM = `2px 2px 0 ${COR_TINTA}`;

function SeloPimenta() {
  return (
    <div
      className="flex shrink-0 -rotate-6 items-center gap-1 rounded-full px-3 py-1"
      style={{ backgroundColor: COR_ACENTO, border: `2px solid ${COR_TINTA}`, boxShadow: SOMBRA_STICKER_SM }}
    >
      <span className="text-sm leading-none" aria-hidden>🌶️</span>
      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: COR_TINTA }}>
        100% Peruano
      </span>
    </div>
  );
}

function IconeSacola({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
      />
    </svg>
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
      <div
        className="flex items-center gap-2.5 rounded-full px-1 py-1"
        style={{ backgroundColor: COR_TINTA, border: `2px solid ${COR_TINTA}` }}
      >
        <button
          type="button"
          onClick={() => onRemover(idUnicoCarrinho)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-black text-white"
        >
          −
        </button>
        <span className="min-w-[1ch] text-center text-sm font-black text-white">{qtd}</span>
        <button
          type="button"
          onClick={() => onAdicionar(produto, complementosSelecionados)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-black text-white"
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
      className="rounded-full px-2.5 py-[3px] text-[9px] font-bold uppercase tracking-wide transition-colors"
      style={{ backgroundColor: COR_ACENTO, border: `2px solid ${COR_TINTA}`, color: COR_TINTA }}
    >
      Adicionar
    </button>
  );
}

interface CartaoProdutoPeruchoProps {
  produto: ItemCardapio;
  expandido: boolean;
  onToggleExpandir: () => void;
}

function CartaoProdutoPerucho({ produto, expandido, onToggleExpandir }: CartaoProdutoPeruchoProps) {
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
  const temComplementos = complementosDisponiveis.length > 0;
  const valorComplementos = complementosSelecionados.reduce((acc, c) => acc + Number(c.preco_adicional), 0);

  const togglePill = (id: string) => {
    setComplementosSelecionadosIds((atuais) =>
      atuais.includes(id) ? atuais.filter((itemId) => itemId !== id) : [...atuais, id]
    );
  };

  return (
    <div
      className="overflow-visible rounded-2xl"
      style={{ backgroundColor: COR_CARTAO, border: `2px solid ${COR_TINTA}`, boxShadow: SOMBRA_STICKER }}
    >
      <button
        type="button"
        onClick={temComplementos ? onToggleExpandir : undefined}
        className="flex w-full items-start gap-3 p-3 text-left"
      >
        <div className="relative shrink-0">
          <div
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl"
            style={{ backgroundColor: COR_FUNDO, border: `2px solid ${COR_TINTA}` }}
          >
            {produto.imagem_url ? (
              <Image src={produto.imagem_url} alt={produto.nome} width={64} height={64} className="h-full w-full object-cover" unoptimized />
            ) : (
              <span className="text-2xl" aria-hidden>🍔</span>
            )}
          </div>
          <span
            className="absolute -bottom-2 -right-2 rotate-3 rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none"
            style={{ backgroundColor: COR_ACENTO, border: `2px solid ${COR_TINTA}`, color: COR_TINTA }}
          >
            {formatarMoeda(Number(produto.preco_venda))}
          </span>
        </div>

        <div className="min-w-0 flex-1 pt-1">
          <h3 className={`${fonteDestaque.className} truncate text-sm uppercase leading-tight`} style={{ color: COR_TINTA }} title={produto.nome}>
            {produto.nome}
          </h3>
          <p className="mt-1 whitespace-pre-line break-words text-xs leading-relaxed" style={{ color: COR_MUTED }}>
            {produto.descricao || 'Feito na hora, no estilo das esquinas de Lima.'}
          </p>

          {!temComplementos && (
            <div className="mt-2 flex justify-end">
              <SeletorQuantidade qtd={qtd} idUnicoCarrinho={idUnicoCarrinho} produto={produto} complementosSelecionados={complementosSelecionados} onAdicionar={adicionarItem} onRemover={removerItem} />
            </div>
          )}
        </div>

        {temComplementos && (
          <svg
            className={`mt-1 h-4 w-4 shrink-0 transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`}
            fill="none" stroke={COR_TINTA} strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        )}
      </button>

      {expandido && temComplementos && (
        <div className="animate-in fade-in space-y-3 border-t-2 px-3 pb-3 pt-3 duration-200" style={{ borderColor: COR_TINTA }}>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: COR_PRIMARIA }}>
            Adicionais
          </span>
          <div className="flex flex-wrap gap-2">
            {complementosDisponiveis.map((complemento) => {
              const selecionado = complementosSelecionadosIds.includes(complemento.id);
              return (
                <button
                  key={complemento.id}
                  type="button"
                  onClick={() => togglePill(complemento.id)}
                  className="rounded-full px-3 py-1.5 text-[11px] font-bold transition-all"
                  style={
                    selecionado
                      ? { backgroundColor: COR_PRIMARIA, color: '#fff', border: `2px solid ${COR_TINTA}` }
                      : { backgroundColor: '#fff', color: COR_TINTA, border: `2px solid ${COR_TINTA}` }
                  }
                >
                  {complemento.nome}
                  <span className={selecionado ? 'ml-1 text-white/80' : 'ml-1'} style={selecionado ? undefined : { color: COR_MUTED }}>
                    +{formatarMoeda(Number(complemento.preco_adicional))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs" style={{ color: COR_MUTED }}>
              {complementosSelecionados.length > 0 && (
                <>Adicionais <span className="font-bold" style={{ color: COR_TINTA }}>+{formatarMoeda(valorComplementos)}</span></>
              )}
            </div>
            <SeletorQuantidade qtd={qtd} idUnicoCarrinho={idUnicoCarrinho} produto={produto} complementosSelecionados={complementosSelecionados} onAdicionar={adicionarItem} onRemover={removerItem} />
          </div>
        </div>
      )}
    </div>
  );
}

type CategoriaPerucho = 'HAMBURGUERES' | 'ACOMPANHAMENTOS' | 'BEBIDAS' | 'SOBREMESAS';

export default function ComponenteLojaPeruchoBurguer({ restaurante, produtos }: ComponenteLojaPeruchoBurguerProps) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens } = useCarrinho();
  const [produtoExpandidoId, setProdutoExpandidoId] = useState<string | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaPerucho>('HAMBURGUERES');

  const alternarExpandido = (produtoId: string) => {
    setProdutoExpandidoId((atual) => (atual === produtoId ? null : produtoId));
  };

  const categoriaDoProduto = (nome: string): CategoriaPerucho => {
    if (/sobremesa|doce|pudim|sorvete|mousse|brownie|torta|picaron/i.test(nome)) return 'SOBREMESAS';
    if (/suco|refrigerante|água|bebida|cerveja|chicha|inca ?kola|drink|guaraná|coca/i.test(nome)) return 'BEBIDAS';
    if (/batata|anel de cebola|onion|nugget|acompanhamento|molho|porção/i.test(nome)) return 'ACOMPANHAMENTOS';
    return 'HAMBURGUERES';
  };

  const categorias: { chave: CategoriaPerucho; rotulo: string }[] = [
    { chave: 'HAMBURGUERES', rotulo: 'Hambúrgueres' },
    { chave: 'ACOMPANHAMENTOS', rotulo: 'Acompanhamentos' },
    { chave: 'BEBIDAS', rotulo: 'Bebidas' },
    { chave: 'SOBREMESAS', rotulo: 'Sobremesas' },
  ];

  const produtosFiltrados = produtos.filter((produto) => categoriaDoProduto(produto.nome) === categoriaAtiva);

  return (
    <div className="min-h-screen antialiased pb-32 font-sans select-none" style={{ backgroundColor: COR_FUNDO }}>
      <header className="relative z-20 mx-auto w-full max-w-xl px-6 pt-6">
        <div className="flex items-start justify-between gap-3">
          <SeloPimenta />
          <Link
            href={`/${slug}/checkout`}
            className="relative shrink-0 rounded-xl p-2"
            style={{ backgroundColor: COR_CARTAO, border: `2px solid ${COR_TINTA}`, boxShadow: SOMBRA_STICKER_SM, color: COR_TINTA }}
            aria-label="Ver sacola"
          >
            <IconeSacola className="h-5 w-5" />
            {totalItens > 0 && (
              <span
                className="absolute -top-2 -right-2 flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black leading-none text-white"
                style={{ backgroundColor: COR_PRIMARIA, border: `2px solid ${COR_TINTA}` }}
              >
                {totalItens}
              </span>
            )}
          </Link>
        </div>

        <h1
          className={`${fonteDestaque.className} mt-4 break-words text-4xl uppercase leading-[0.95] sm:text-5xl`}
          style={{ color: COR_TINTA }}
        >
          {restaurante.nome || 'Perucho Burguer'}
        </h1>
        <p className="mt-2 text-xs font-medium" style={{ color: COR_MUTED }}>
          Hambúrguer artesanal com tempero peruano — direto pra sua casa.
        </p>
      </header>

      <div className="mx-auto w-full max-w-xl px-6">
        <nav className="flex items-center gap-2 overflow-x-auto py-6 scrollbar-none">
          {categorias.map((categoria) => (
            <button
              key={categoria.chave}
              type="button"
              onClick={() => setCategoriaAtiva(categoria.chave)}
              className="shrink-0 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors"
              style={
                categoriaAtiva === categoria.chave
                  ? { backgroundColor: COR_TINTA, color: '#fff', border: `2px solid ${COR_TINTA}` }
                  : { backgroundColor: COR_CARTAO, color: COR_TINTA, border: `2px solid ${COR_TINTA}` }
              }
            >
              {categoria.rotulo}
            </button>
          ))}
        </nav>

        <div className="space-y-4 pb-2">
          {produtosFiltrados.length === 0 ? (
            <div
              className="rounded-2xl py-16 text-center"
              style={{ backgroundColor: COR_CARTAO, border: `2px solid ${COR_TINTA}`, boxShadow: SOMBRA_STICKER }}
            >
              <p className="text-xs font-semibold" style={{ color: COR_MUTED }}>
                Cardápio na chapa — volte em breve.
              </p>
            </div>
          ) : (
            produtosFiltrados.map((produto) => (
              <CartaoProdutoPerucho
                key={produto.id}
                produto={produto}
                expandido={produtoExpandidoId === produto.id}
                onToggleExpandir={() => alternarExpandido(produto.id)}
              />
            ))
          )}
        </div>

        <div className="mt-10 flex flex-col items-center gap-2 pb-4 text-center">
          <span className="h-[2px] w-16" style={{ backgroundColor: COR_TINTA }} aria-hidden />
          <p className="text-[11px] font-medium" style={{ color: COR_MUTED }}>
            {restaurante.endereco?.trim() || 'Endereço do estabelecimento'}
          </p>
        </div>
      </div>

      <BarraCarrinhoFlutuante corBotaoAcao={COR_TINTA} corBadgeFundo={COR_ACENTO} corBadgeTexto={COR_TINTA} />
    </div>
  );
}
