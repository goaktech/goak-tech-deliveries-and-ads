'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Playfair_Display } from 'next/font/google';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';

const fonteElegante = Playfair_Display({ subsets: ['latin'], weight: ['600', '700'], style: ['normal', 'italic'] });

interface ComponenteLojaWcsAcaiteriaProps {
  restaurante: { id: string; nome: string; endereco: string | null };
  produtos: ItemCardapio[];
}

const COR_ROXO = '#2A1F42';
const COR_ROXO_ESCURO = '#1C1430';
const COR_DOURADO = '#D4A544';
const COR_TEAL = '#3C9C86';
const COR_CREME = '#FBF3E4';
const COR_FUNDO_PAGINA = '#FAF6EE';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ConfeteDourado() {
  const pontos = [
    { x: 24, y: 38, r: 10 },
    { x: 340, y: 60, r: 8 },
    { x: 60, y: 130, r: 7 },
    { x: 310, y: 150, r: 9 },
    { x: 20, y: 190, r: 6 },
    { x: 355, y: 210, r: 7 },
  ];
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-90" viewBox="0 0 380 230" aria-hidden>
      {pontos.map((p, i) => (
        <rect
          key={i}
          x={p.x - p.r / 2}
          y={p.y - p.r / 2}
          width={p.r}
          height={p.r}
          fill={COR_DOURADO}
          transform={`rotate(45 ${p.x} ${p.y})`}
        />
      ))}
    </svg>
  );
}


interface CartaoProdutoWcsProps {
  produto: ItemCardapio;
  expandido: boolean;
  onToggleExpandir: () => void;
}

function CartaoProdutoWcs({ produto, expandido, onToggleExpandir }: CartaoProdutoWcsProps) {
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
            <span className="text-2xl" aria-hidden>🍇</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className={`${fonteElegante.className} truncate text-base font-semibold text-zinc-900`}>{produto.nome}</h3>
          <p className="mt-0.5 truncate text-xs text-zinc-400">{produto.descricao || 'Açaí montado na hora.'}</p>
        </div>

        <span className={`${fonteElegante.className} shrink-0 text-sm font-bold`} style={{ color: COR_TEAL }}>
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
                        ? { backgroundColor: COR_ROXO, borderColor: COR_ROXO, color: '#fff' }
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
          style={{ backgroundColor: COR_ROXO }}
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

export default function ComponenteLojaWcsAcaiteria({ restaurante, produtos }: ComponenteLojaWcsAcaiteriaProps) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens } = useCarrinho();
  const [produtoExpandidoId, setProdutoExpandidoId] = useState<string | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<'BOWLS' | 'COBERTURAS' | 'BEBIDAS'>('BOWLS');

  const alternarExpandido = (produtoId: string) => {
    setProdutoExpandidoId((atual) => (atual === produtoId ? null : produtoId));
  };

  const categoriaDoProduto = (nome: string) => {
    if (/cobertura|topping/i.test(nome)) return 'COBERTURAS';
    if (/suco|água|refrigerante|bebida/i.test(nome)) return 'BEBIDAS';
    return 'BOWLS';
  };

  const produtosFiltrados = produtos.filter((produto) => categoriaDoProduto(produto.nome) === categoriaAtiva);

  return (
    <div className="min-h-screen antialiased pb-32 font-sans select-none" style={{ backgroundColor: COR_FUNDO_PAGINA }}>
      <div className="relative w-full overflow-hidden" style={{ backgroundColor: COR_ROXO }}>
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(circle at 30% 20%, ${COR_ROXO_ESCURO}, ${COR_ROXO} 70%)` }}
          aria-hidden
        />
        <ConfeteDourado />

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

        <div className="relative z-10 mx-auto mt-5 w-full max-w-xl px-6 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {restaurante.nome}
          </h1>
        </div>

        <div className="relative z-10 mx-auto mt-3 flex w-full max-w-xl justify-center px-6">
          <div
            className="rounded-md px-6 py-2 text-center shadow-sm"
            style={{ backgroundColor: COR_DOURADO }}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: COR_ROXO_ESCURO }}>
              Açaí Premium
            </span>
          </div>
        </div>

        <div className="relative z-10 mt-6 h-1 w-full" style={{ backgroundColor: COR_FUNDO_PAGINA }} />
      </div>

      <div className="relative z-10 w-full py-2" style={{ backgroundColor: COR_TEAL }}>
        <div className="mx-auto flex w-full max-w-xl items-center justify-center px-6">
          <div
            className="rounded-sm px-5 py-2 text-center shadow-sm"
            style={{
              backgroundColor: COR_CREME,
              clipPath:
                'polygon(0% 15%, 4% 0%, 8% 15%, 12% 0%, 16% 15%, 20% 0%, 24% 15%, 28% 0%, 32% 15%, 36% 0%, 40% 15%, 44% 0%, 48% 15%, 52% 0%, 56% 15%, 60% 0%, 64% 15%, 68% 0%, 72% 15%, 76% 0%, 80% 15%, 84% 0%, 88% 15%, 92% 0%, 96% 15%, 100% 0%, 100% 100%, 0% 100%)',
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: COR_TEAL }}>
              Puro Açaí
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 w-full max-w-xl px-6">
        <nav className="mb-5 flex items-center gap-2 overflow-x-auto text-xs font-bold scrollbar-none">
          {(
            [
              { chave: 'BOWLS', rotulo: 'Bowls' },
              { chave: 'COBERTURAS', rotulo: 'Coberturas' },
              { chave: 'BEBIDAS', rotulo: 'Bebidas' },
            ] as const
          ).map((aba) => (
            <button
              key={aba.chave}
              type="button"
              onClick={() => setCategoriaAtiva(aba.chave)}
              className="shrink-0 rounded-full px-4 py-2 uppercase tracking-wide transition-colors"
              style={
                categoriaAtiva === aba.chave
                  ? { backgroundColor: COR_ROXO, color: '#fff' }
                  : { backgroundColor: '#fff', color: '#57534e', border: '1px solid #EFE4CD' }
              }
            >
              {aba.rotulo}
            </button>
          ))}
        </nav>

        <div className="space-y-3">
          {produtosFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E7DCC4] bg-white py-16 text-center text-zinc-400 shadow-sm">
              <p className="text-xs font-bold">Cardápio sendo preparado — volte em breve.</p>
            </div>
          ) : (
            produtosFiltrados.map((produto) => (
              <CartaoProdutoWcs
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

      <BarraCarrinhoFlutuante corBotaoAcao={COR_ROXO} corBadgeFundo={COR_DOURADO} corBadgeTexto={COR_ROXO_ESCURO} />
    </div>
  );
}
