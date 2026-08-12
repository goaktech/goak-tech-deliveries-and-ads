'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';

interface ComponenteLojaNamiSushiBarProps {
  restaurante: { id: string; nome: string; endereco: string | null };
  produtos: ItemCardapio[];
}

const COR_PRETO = '#1F1F1F';
const COR_ROSE = '#E3A79C';
const COR_ROSE_ESCURO = '#C98A7E';
const COR_CINZA_PILL = '#F3F1EC';
const COR_FUNDO_PAGINA = '#FFFFFF';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function FaixaOndas() {
  return (
    <svg className="block h-16 w-full" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden>
      <path d="M0,40 C60,10 100,55 160,32 C220,10 260,50 320,28 C350,18 380,30 400,24 L400,64 L0,64 Z" fill="#DCDAD3" />
      <path d="M0,50 C50,30 110,58 170,44 C230,30 280,56 340,40 C365,32 385,40 400,36 L400,64 L0,64 Z" fill="#EAE8E1" />
    </svg>
  );
}

interface CartaoProdutoNamiProps {
  produto: ItemCardapio;
  expandido: boolean;
  onToggleExpandir: () => void;
}

function CartaoProdutoNami({ produto, expandido, onToggleExpandir }: CartaoProdutoNamiProps) {
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
    <div className="border-b border-zinc-100 py-4 last:border-b-0">
      <button
        type="button"
        onClick={temComplementos ? onToggleExpandir : undefined}
        className="flex w-full items-center gap-4 text-left"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ backgroundColor: COR_CINZA_PILL }}>
          {produto.imagem_url ? (
            <Image src={produto.imagem_url} alt={produto.nome} width={56} height={56} className="h-full w-full object-cover" unoptimized />
          ) : (
            <span className="text-xl" aria-hidden>🍣</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-zinc-900">{produto.nome}</h3>
          <p className="mt-0.5 truncate text-xs font-light text-zinc-400">{produto.descricao || 'Preparo do dia.'}</p>
        </div>

        <div className="shrink-0 text-right">
          <span className="block font-mono text-sm font-semibold text-zinc-900">
            {formatarMoeda(Number(produto.preco_venda))}
          </span>
          {temComplementos ? (
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide" style={{ color: COR_ROSE_ESCURO }}>
              {expandido ? 'fechar' : 'opções'}
            </span>
          ) : null}
        </div>
      </button>

      {expandido && temComplementos && (
        <div className="animate-in fade-in mt-4 space-y-4 duration-200">
          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Adicionais</span>
            <div className="grid grid-cols-2 gap-2">
              {complementosDisponiveis.map((complemento) => {
                const selecionado = complementosSelecionadosIds.includes(complemento.id);
                return (
                  <button
                    key={complemento.id}
                    type="button"
                    onClick={() => togglePill(complemento.id)}
                    className="rounded-full border px-3.5 py-2 text-center transition-all"
                    style={
                      selecionado
                        ? { backgroundColor: COR_PRETO, borderColor: COR_PRETO, color: '#fff' }
                        : { backgroundColor: '#fff', borderColor: '#E5E5E0', color: '#3f3f46' }
                    }
                  >
                    <span className="block truncate text-[11px] font-medium leading-tight">{complemento.nome}</span>
                    <span className={`mt-0.5 block text-[10px] ${selecionado ? 'text-white/80' : 'text-zinc-400'}`}>
                      +{formatarMoeda(Number(complemento.preco_adicional))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-zinc-500">
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
        <div className="mt-3 flex justify-end">
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
      <div className="flex items-center gap-2.5 rounded-full border border-zinc-200 bg-white p-1">
        <button
          type="button"
          onClick={() => onRemover(idUnicoCarrinho)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-50 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
        >
          -
        </button>
        <span className="px-0.5 font-mono text-sm font-semibold text-zinc-800">{qtd}</span>
        <button
          type="button"
          onClick={() => onAdicionar(produto, complementosSelecionados)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-white"
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
      className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-900 transition-all"
      style={{ backgroundColor: COR_ROSE }}
    >
      Adicionar
    </button>
  );
}

export default function ComponenteLojaNamiSushiBar({ restaurante, produtos }: ComponenteLojaNamiSushiBarProps) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens } = useCarrinho();
  const [produtoExpandidoId, setProdutoExpandidoId] = useState<string | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<'COMBINADOS' | 'SASHIMI' | 'TEMAKI' | 'HOT_ROLLS' | 'BEBIDAS'>('COMBINADOS');

  const alternarExpandido = (produtoId: string) => {
    setProdutoExpandidoId((atual) => (atual === produtoId ? null : produtoId));
  };

  const categoriaDoProduto = (nome: string) => {
    if (/combinado/i.test(nome)) return 'COMBINADOS';
    if (/sashimi/i.test(nome)) return 'SASHIMI';
    if (/temaki/i.test(nome)) return 'TEMAKI';
    if (/hot roll|uramaki/i.test(nome)) return 'HOT_ROLLS';
    if (/água|chá|ramune|refrigerante|suco/i.test(nome)) return 'BEBIDAS';
    return 'COMBINADOS';
  };

  const produtosFiltrados = produtos.filter((produto) => categoriaDoProduto(produto.nome) === categoriaAtiva);

  return (
    <div className="min-h-screen antialiased pb-32 font-sans select-none" style={{ backgroundColor: COR_FUNDO_PAGINA }}>
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-6 pt-6">
        <button className="text-zinc-800/70 transition-colors hover:text-zinc-900">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link href={`/${slug}/checkout`} className="relative text-zinc-800/70 transition-colors hover:text-zinc-900" aria-label="Ver sacola">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
          </svg>
          {totalItens > 0 && (
            <span
              className="absolute -top-2 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
              style={{ backgroundColor: COR_ROSE_ESCURO }}
            >
              {totalItens}
            </span>
          )}
        </Link>
      </header>

      <div className="relative mx-auto w-full max-w-xl overflow-hidden px-6 pt-2">
        <h1
          className="select-none whitespace-nowrap text-[22vw] font-extrabold leading-[0.8] tracking-tighter text-zinc-900 sm:text-[7.5rem]"
          style={{ color: COR_PRETO }}
        >
          nami
        </h1>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-400">
          Sushi Bar
        </span>
      </div>

      <div className="mx-auto mt-6 w-full max-w-xl px-6">
        <div className="space-y-1 text-sm font-light leading-relaxed text-zinc-600">
          <p>Peixe fresco, direto da feira</p>
          <p>Corte no ponto, todo dia</p>
          <p>Arroz temperado na hora</p>
        </div>

        <a
          href="#cardapio"
          className="mt-5 inline-flex items-center rounded-full px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-900 shadow-sm transition-all hover:brightness-95"
          style={{ backgroundColor: COR_ROSE }}
        >
          Ver cardápio
        </a>
      </div>

      <div className="mt-8 w-full">
        <FaixaOndas />
      </div>

      <div id="cardapio" className="mx-auto mt-8 w-full max-w-xl px-6">
        <nav className="mb-2 flex items-center gap-5 overflow-x-auto text-xs font-medium text-zinc-500 scrollbar-none">
          {(
            [
              { chave: 'COMBINADOS', rotulo: 'Combinados' },
              { chave: 'SASHIMI', rotulo: 'Sashimi' },
              { chave: 'TEMAKI', rotulo: 'Temaki' },
              { chave: 'HOT_ROLLS', rotulo: 'Hot Rolls' },
              { chave: 'BEBIDAS', rotulo: 'Bebidas' },
            ] as const
          ).map((aba) => (
            <button
              key={aba.chave}
              type="button"
              onClick={() => setCategoriaAtiva(aba.chave)}
              className="shrink-0 border-b-2 pb-2 uppercase tracking-wide transition-colors"
              style={
                categoriaAtiva === aba.chave
                  ? { borderColor: COR_PRETO, color: COR_PRETO }
                  : { borderColor: 'transparent', color: '#a1a1aa' }
              }
            >
              {aba.rotulo}
            </button>
          ))}
        </nav>

        <div>
          {produtosFiltrados.length === 0 ? (
            <div className="py-16 text-center text-zinc-400">
              <p className="text-xs font-light">Nada por aqui ainda — confira as outras abas.</p>
            </div>
          ) : (
            produtosFiltrados.map((produto) => (
              <CartaoProdutoNami
                key={produto.id}
                produto={produto}
                expandido={produtoExpandidoId === produto.id}
                onToggleExpandir={() => alternarExpandido(produto.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-xl px-6 text-center text-[11px] font-light text-zinc-400">
        {restaurante.endereco?.trim() || 'Endereço do estabelecimento'}
      </div>

      <BarraCarrinhoFlutuante corBotaoAcao={COR_PRETO} corBadgeFundo={COR_ROSE} corBadgeTexto={COR_PRETO} />
    </div>
  );
}
