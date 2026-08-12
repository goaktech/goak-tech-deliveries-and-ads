'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from './ContextoCarrinho';
import BarraCarrinhoFlutuante from './BarraCarrinhoFlutuante';

interface ComponenteLojaRestauranteTradicionalProps {
  restaurante: { id: string; nome: string; endereco: string | null };
  produtos: ItemCardapio[];
}

const COR_CORAL = '#D9614F';
const COR_CORAL_ESCURO = '#B84A3B';
const COR_TEAL = '#3E8E82';
const COR_TEAL_ESCURO = '#2C685F';
const COR_CREME = '#FBF3E4';
const COR_DOURADO = '#C9A227';
const COR_BORDO = '#7A2426';
const COR_FUNDO_PAGINA = '#FAF6EE';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function LinhaPontilhada({ cor = COR_CREME, opacidade = 0.6 }: { cor?: string; opacidade?: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className="h-1 w-1 rounded-full" style={{ backgroundColor: cor, opacity: opacidade }} />
      ))}
    </div>
  );
}

function IconeGarfo({ x, y, rotacao = 0 }: { x: number; y: number; rotacao?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotacao})`} stroke={COR_BORDO} strokeWidth="1.4" fill="none" strokeLinecap="round">
      <line x1="0" y1="-16" x2="0" y2="16" />
      <line x1="-4" y1="-16" x2="-4" y2="-6" />
      <line x1="4" y1="-16" x2="4" y2="-6" />
      <path d="M-4,-6 Q0,-1 4,-6" />
    </g>
  );
}

function IconeFaca({ x, y, rotacao = 0 }: { x: number; y: number; rotacao?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotacao})`} stroke={COR_BORDO} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0,16 L0,-2 L-5,-16 L3,-16 L3,-2" />
    </g>
  );
}

function IconeCopo({ x, y, rotacao = 0 }: { x: number; y: number; rotacao?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotacao})`} stroke={COR_BORDO} strokeWidth="1.4" fill="none" strokeLinecap="round">
      <path d="M-8,-18 L8,-18 L6,14 L-6,14 Z" />
      <line x1="-7" y1="-7" x2="6.5" y2="-7" opacity="0.7" />
      <line x1="1" y1="-26" x2="3.5" y2="-6" />
    </g>
  );
}

function IconeFatiaBolo({ x, y, rotacao = 0 }: { x: number; y: number; rotacao?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotacao})`} stroke={COR_BORDO} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-13,12 L13,12 L3,-13 Z" />
      <line x1="-8" y1="5" x2="8" y2="5" opacity="0.7" />
      <circle cx="3" cy="-16" r="1.8" fill={COR_DOURADO} stroke="none" />
    </g>
  );
}

function IconeDonut({ x, y, rotacao = 0 }: { x: number; y: number; rotacao?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotacao})`} stroke={COR_BORDO} strokeWidth="1.4" fill="none">
      <circle r="12" />
      <circle r="4.5" />
      <path d="M-9,-6 Q-3,-2 2,-8 Q6,-3 10,-6" strokeLinecap="round" opacity="0.75" />
    </g>
  );
}

function IconeHamburguer({ x, y, rotacao = 0 }: { x: number; y: number; rotacao?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotacao})`} stroke={COR_BORDO} strokeWidth="1.4" fill="none" strokeLinecap="round">
      <path d="M-13,-2 Q-13,-12 0,-12 Q13,-12 13,-2 Z" />
      <line x1="-13" y1="1" x2="13" y2="1" opacity="0.75" />
      <line x1="-13" y1="5" x2="13" y2="5" opacity="0.6" />
      <path d="M-13,9 L13,9 Q13,15 0,15 Q-13,15 -13,9 Z" />
    </g>
  );
}

function IconeCupcake({ x, y, rotacao = 0 }: { x: number; y: number; rotacao?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotacao})`} stroke={COR_BORDO} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-9,14 L9,14 L7,0 L-7,0 Z" />
      <path d="M-8,0 Q0,-14 8,0 Q4,-4 0,0 Q-4,-4 -8,0 Z" />
      <circle cx="0" cy="-14" r="1.8" fill={COR_CORAL} stroke="none" />
    </g>
  );
}

function IconeEspetinho({ x, y, rotacao = 0 }: { x: number; y: number; rotacao?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotacao})`} stroke={COR_BORDO} strokeWidth="1.4" fill="none" strokeLinecap="round">
      <line x1="-14" y1="10" x2="14" y2="-10" />
      <circle cx="-6" cy="4" r="4" />
      <circle cx="2" cy="-3" r="4" />
      <circle cx="9" cy="-8" r="3" fill={COR_CORAL} stroke="none" />
    </g>
  );
}

function IconesComidaEspalhados() {
  return (
    <svg viewBox="0 0 400 90" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <IconeGarfo x={36} y={27} rotacao={-6} />
      <IconeCopo x={112} y={29} rotacao={4} />
      <IconeFatiaBolo x={192} y={25} rotacao={-4} />
      <IconeDonut x={270} y={25} rotacao={0} />
      <IconeHamburguer x={348} y={27} rotacao={6} />

      <IconeFaca x={74} y={65} rotacao={-10} />
      <IconeCupcake x={152} y={67} rotacao={5} />
      <IconeEspetinho x={236} y={65} rotacao={12} />
      <IconeDonut x={320} y={65} rotacao={18} />
    </svg>
  );
}

interface CartaoProdutoTradicionalProps {
  produto: ItemCardapio;
  expandido: boolean;
  onToggleExpandir: () => void;
}

function CartaoProdutoTradicional({ produto, expandido, onToggleExpandir }: CartaoProdutoTradicionalProps) {
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
    <div className="overflow-hidden rounded-2xl border border-[#E7DCC4] bg-white shadow-sm transition-all duration-300">
      <button
        type="button"
        onClick={temComplementos ? onToggleExpandir : undefined}
        className={`flex w-full items-center gap-4 p-4 text-left transition-colors ${
          expandido ? 'bg-[#FBF3E4]' : temComplementos ? 'hover:bg-zinc-50' : ''
        }`}
      >
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ backgroundColor: COR_CREME }}>
          {produto.imagem_url ? (
            <Image src={produto.imagem_url} alt={produto.nome} width={64} height={64} className="h-full w-full object-cover" unoptimized />
          ) : (
            <span className="text-2xl" aria-hidden>🍽️</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-extrabold text-zinc-900">{produto.nome}</h3>
          <p className="mt-0.5 truncate text-xs text-zinc-400">{produto.descricao || 'Feito na casa, todo dia.'}</p>
        </div>

        <span className="shrink-0 text-sm font-bold" style={{ color: COR_TEAL_ESCURO }}>
          {formatarMoeda(Number(produto.preco_venda))}
        </span>
      </button>

      {expandido && temComplementos && (
        <div className="animate-in fade-in space-y-4 border-t border-[#EFE4CD] p-4 duration-200">
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: COR_DOURADO }}>
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
                    className="rounded-xl border px-3 py-2 text-center transition-all"
                    style={
                      selecionado
                        ? { backgroundColor: COR_CORAL, borderColor: COR_CORAL, color: '#fff' }
                        : { backgroundColor: '#fff', borderColor: '#EFE4CD', color: '#3f3f46' }
                    }
                  >
                    <span className="block truncate text-[11px] font-semibold leading-tight">{complemento.nome}</span>
                    <span className={`mt-0.5 block text-[10px] ${selecionado ? 'text-white/80' : 'text-zinc-400'}`}>
                      +{formatarMoeda(Number(complemento.preco_adicional))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#EFE4CD] pt-3">
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
      <div className="flex items-center gap-2.5 rounded-xl border border-[#EFE4CD] bg-zinc-50 p-1">
        <button
          type="button"
          onClick={() => onRemover(idUnicoCarrinho)}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sm font-bold text-zinc-600 shadow-sm hover:bg-zinc-100"
        >
          -
        </button>
        <span className="px-0.5 font-mono text-sm font-bold text-zinc-800">{qtd}</span>
        <button
          type="button"
          onClick={() => onAdicionar(produto, complementosSelecionados)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
          style={{ backgroundColor: COR_CORAL }}
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
      className="rounded-xl px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all"
      style={{ backgroundColor: COR_TEAL }}
    >
      Adicionar
    </button>
  );
}

type CategoriaTradicional = 'ENTRADAS' | 'PRATOS' | 'ACOMPANHAMENTOS' | 'BEBIDAS' | 'SOBREMESAS';

export default function ComponenteLojaRestauranteTradicional({ restaurante, produtos }: ComponenteLojaRestauranteTradicionalProps) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens } = useCarrinho();
  const [produtoExpandidoId, setProdutoExpandidoId] = useState<string | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaTradicional>('PRATOS');

  const alternarExpandido = (produtoId: string) => {
    setProdutoExpandidoId((atual) => (atual === produtoId ? null : produtoId));
  };

  const categoriaDoProduto = (nome: string): CategoriaTradicional => {
    if (/entrada|couvert|petisco|aperitivo/i.test(nome)) return 'ENTRADAS';
    if (/sobremesa|doce|pudim|sorvete|mousse/i.test(nome)) return 'SOBREMESAS';
    if (/suco|refrigerante|água|bebida|cerveja|drink|vinho/i.test(nome)) return 'BEBIDAS';
    if (/acompanhamento|arroz|feijão|farofa|salada|purê|fritas/i.test(nome)) return 'ACOMPANHAMENTOS';
    return 'PRATOS';
  };

  const categorias: { chave: CategoriaTradicional; rotulo: string }[] = [
    { chave: 'ENTRADAS', rotulo: 'Entradas' },
    { chave: 'PRATOS', rotulo: 'Pratos' },
    { chave: 'ACOMPANHAMENTOS', rotulo: 'Acompanhamentos' },
    { chave: 'BEBIDAS', rotulo: 'Bebidas' },
    { chave: 'SOBREMESAS', rotulo: 'Sobremesas' },
  ];

  const produtosFiltrados = produtos.filter((produto) => categoriaDoProduto(produto.nome) === categoriaAtiva);

  return (
    <div className="min-h-screen antialiased pb-32 font-sans select-none" style={{ backgroundColor: COR_FUNDO_PAGINA }}>
      <div className="relative w-full overflow-hidden" style={{ backgroundColor: COR_CORAL }}>
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(circle at 30% 15%, ${COR_CORAL_ESCURO}, ${COR_CORAL} 72%)` }}
          aria-hidden
        />

        <header className="relative z-10 mx-auto flex w-full max-w-xl items-center justify-between px-6 pt-6">
          <button className="text-white/80 transition-colors hover:text-white">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href={`/${slug}/checkout`} className="relative text-white/80 transition-colors hover:text-white" aria-label="Ver sacola">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
            </svg>
            {totalItens > 0 && (
              <span
                className="absolute -top-2 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none text-white"
                style={{ backgroundColor: COR_DOURADO }}
              >
                {totalItens}
              </span>
            )}
          </Link>
        </header>

        <div className="relative z-10 mx-auto mt-5 flex w-full max-w-xl justify-center px-6">
          <div
            className="rounded-md border border-dashed px-6 py-2 text-center shadow-sm"
            style={{ backgroundColor: COR_TEAL, borderColor: 'rgba(251,243,228,0.5)' }}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: COR_CREME }}>
              Culinária Caseira
            </span>
          </div>
        </div>

        <div className="relative z-10 mt-3">
          <LinhaPontilhada />
        </div>

        <div className="relative z-10 mx-auto mt-4 w-full max-w-xl px-6 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {restaurante.nome}
          </h1>
          <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
            Sabor de casa, todo dia
          </span>
        </div>

        <div className="relative z-10 mt-6 h-24 w-full bg-white">
          <IconesComidaEspalhados />
        </div>
      </div>

      <div className="relative z-10 -mt-6 flex w-full justify-center px-6">
        <div
          className="max-w-xs text-center shadow-sm"
          style={{
            backgroundColor: COR_CREME,
            borderRadius: '50% 50% 10px 10px / 60% 60% 10px 10px',
            padding: '18px 32px 12px',
          }}
        >
          <span className="block text-sm font-extrabold uppercase tracking-wide" style={{ color: COR_BORDO }}>
            Feito com Carinho
          </span>
          <span className="mt-1 block text-[11px] text-zinc-500">Receitas de família, direto da cozinha</span>
        </div>
      </div>

      <div className="mx-auto mt-6 w-full max-w-xl px-6">
        <nav className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categorias.map((categoria) => (
            <button
              key={categoria.chave}
              type="button"
              onClick={() => setCategoriaAtiva(categoria.chave)}
              className="shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all"
              style={
                categoriaAtiva === categoria.chave
                  ? { backgroundColor: COR_CORAL, color: '#fff' }
                  : { backgroundColor: '#fff', color: '#71717a', border: '1px solid #E7DCC4' }
              }
            >
              {categoria.rotulo}
            </button>
          ))}
        </nav>

        <div className="mt-5 space-y-3">
          {produtosFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-[#E7DCC4] bg-white py-14 text-center shadow-sm">
              <p className="text-xs font-semibold text-zinc-400">Cardápio sendo preparado — volte em breve.</p>
            </div>
          ) : (
            produtosFiltrados.map((produto) => (
              <CartaoProdutoTradicional
                key={produto.id}
                produto={produto}
                expandido={produtoExpandidoId === produto.id}
                onToggleExpandir={() => alternarExpandido(produto.id)}
              />
            ))
          )}
        </div>

        {restaurante.endereco && (
          <p className="mt-8 text-center text-[11px] text-zinc-400">{restaurante.endereco}</p>
        )}
      </div>

      <BarraCarrinhoFlutuante corBotaoAcao={COR_TEAL} corBadgeFundo={COR_DOURADO} corBadgeTexto={COR_BORDO} />
    </div>
  );
}
