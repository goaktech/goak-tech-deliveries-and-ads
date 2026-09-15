'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Fraunces } from 'next/font/google';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';
import {
  categoriaDoProduto,
  produtoDisponivelHoje,
  rotuloDiaSemana,
  type CategoriaCantina,
} from '@/utils/cardapio-cantina-brasil';

const fonteExibicao = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
});

interface ComponenteLojaCantinaBrasilProps {
  restaurante: { id: string; nome: string; endereco: string | null };
  produtos: ItemCardapio[];
}

const COR_MARROM = '#2A1A10';
const COR_MARROM_SUAVE = '#7A5A3A';
const COR_DOURADO = '#C8892E';
const COR_DOURADO_CLARO = '#E8B65A';
const COR_CREME = '#FBF3E4';
const COR_CREME_ESCURO = '#F1E1BF';
const COR_TERRACOTA = '#9C4E24';
const COR_VERDE = '#5C7A46';
const COR_LINHA = '#E6D2A6';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const ORDEM_CATEGORIAS: { chave: CategoriaCantina; rotulo: string }[] = [
  { chave: 'PRATOS', rotulo: 'Pratos do Dia' },
  { chave: 'ACOMPANHAMENTOS', rotulo: 'Acompanhamentos' },
  { chave: 'BEBIDAS', rotulo: 'Bebidas' },
  { chave: 'SOBREMESAS', rotulo: 'Sobremesas' },
];

function IconeFolha({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke={COR_VERDE} strokeWidth="1.4" aria-hidden>
      <path d="M4 20c8-1 14-7 15-16C10 5 4 11 4 20Z" strokeLinejoin="round" />
      <path d="M5.5 18.5C9 15 12 12 17.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

function DivisorOrnamental() {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden>
      <span className="h-px w-10" style={{ backgroundColor: COR_DOURADO, opacity: 0.5 }} />
      <IconeFolha className="h-4 w-4 shrink-0" />
      <span className="h-px w-10" style={{ backgroundColor: COR_DOURADO, opacity: 0.5 }} />
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
      <div className="flex items-center gap-3 rounded-full px-1 py-1" style={{ border: `1.5px solid ${COR_MARROM}` }}>
        <button
          type="button"
          onClick={() => onRemover(idUnicoCarrinho)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold"
          style={{ color: COR_MARROM }}
        >
          −
        </button>
        <span className="min-w-[1ch] text-center text-sm font-semibold" style={{ color: COR_MARROM }}>{qtd}</span>
        <button
          type="button"
          onClick={() => onAdicionar(produto, complementosSelecionados)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: COR_MARROM }}
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
      className="rounded-full px-2.5 py-[3px] text-[9px] font-semibold uppercase tracking-wide transition-colors"
      style={{ border: `1.25px solid ${COR_MARROM}`, color: COR_MARROM }}
    >
      Adicionar
    </button>
  );
}

/** Prato do dia fora do dia dele: mostra quando ele volta em vez do botão de adicionar. */
function EtiquetaForaDoDia({ diaSemana }: { diaSemana: number }) {
  return (
    <span
      className="rounded-full px-2.5 py-[3px] text-[9px] font-semibold uppercase tracking-wide"
      style={{ border: `1.25px dashed ${COR_MARROM_SUAVE}`, color: COR_MARROM_SUAVE }}
    >
      Disponível {rotuloDiaSemana(diaSemana)}
    </span>
  );
}

interface LinhaProdutoCantinaProps {
  produto: ItemCardapio;
  expandido: boolean;
  onToggleExpandir: () => void;
}

function LinhaProdutoCantina({ produto, expandido, onToggleExpandir }: LinhaProdutoCantinaProps) {
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

  // Cada prato do dia é servido em 1 dia da semana fixo; fora desse dia o
  // item continua visível no cardápio, só não dá pra adicionar. Acompanhamentos,
  // bebidas e sobremesas não têm essa restrição.
  const categoria = categoriaDoProduto(produto);
  const disponivelHoje = categoria !== 'PRATOS' || produtoDisponivelHoje(produto);

  const togglePill = (id: string) => {
    setComplementosSelecionadosIds((atuais) =>
      atuais.includes(id) ? atuais.filter((itemId) => itemId !== id) : [...atuais, id]
    );
  };

  return (
    <div className="border-b" style={{ borderColor: COR_LINHA }}>
      <button
        type="button"
        onClick={temComplementos ? onToggleExpandir : undefined}
        className="flex w-full items-start gap-3 py-4 text-left"
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md"
          style={{ backgroundColor: COR_CREME_ESCURO, border: `1px solid ${COR_LINHA}` }}
        >
          {produto.imagem_url ? (
            <Image src={produto.imagem_url} alt={produto.nome} width={56} height={56} className="h-full w-full object-cover" unoptimized />
          ) : (
            <span className="text-xl" aria-hidden>🍲</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3
              className={`${fonteExibicao.className} min-w-0 truncate text-[15px] font-semibold`}
              style={{ color: COR_MARROM }}
              title={produto.nome}
            >
              {produto.nome}
            </h3>
            <span className="relative top-[-3px] h-0 flex-1 border-b border-dotted" style={{ borderColor: COR_DOURADO, opacity: 0.6 }} aria-hidden />
            <span className="shrink-0 text-sm font-semibold" style={{ color: COR_TERRACOTA }}>
              {formatarMoeda(Number(produto.preco_venda))}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-line break-words text-xs italic text-zinc-500">{produto.descricao || 'Feito em casa, todo dia.'}</p>

          {!temComplementos && (
            <div className="mt-3 flex justify-end">
              {disponivelHoje ? (
                <SeletorQuantidade qtd={qtd} idUnicoCarrinho={idUnicoCarrinho} produto={produto} complementosSelecionados={complementosSelecionados} onAdicionar={adicionarItem} onRemover={removerItem} />
              ) : (
                <EtiquetaForaDoDia diaSemana={produto.dia_semana as number} />
              )}
            </div>
          )}
        </div>
      </button>

      {expandido && temComplementos && (
        <div className="animate-in fade-in space-y-3 pb-4 pl-[68px] duration-200">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: COR_MARROM_SUAVE }}>
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
                  className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-all"
                  style={
                    selecionado
                      ? { backgroundColor: COR_MARROM, color: '#fff', border: `1px solid ${COR_MARROM}` }
                      : { backgroundColor: 'transparent', color: COR_MARROM, border: `1px solid ${COR_LINHA}` }
                  }
                >
                  {complemento.nome}
                  <span className={selecionado ? 'ml-1 text-white/70' : 'ml-1 text-zinc-400'}>
                    +{formatarMoeda(Number(complemento.preco_adicional))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs" style={{ color: COR_MARROM_SUAVE }}>
              {complementosSelecionados.length > 0 && (
                <>Adicionais <span className="font-semibold">+{formatarMoeda(valorComplementos)}</span></>
              )}
            </div>
            {disponivelHoje ? (
              <SeletorQuantidade qtd={qtd} idUnicoCarrinho={idUnicoCarrinho} produto={produto} complementosSelecionados={complementosSelecionados} onAdicionar={adicionarItem} onRemover={removerItem} />
            ) : (
              <EtiquetaForaDoDia diaSemana={produto.dia_semana as number} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComponenteLojaCantinaBrasil({ restaurante, produtos }: ComponenteLojaCantinaBrasilProps) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens } = useCarrinho();
  const [produtoExpandidoId, setProdutoExpandidoId] = useState<string | null>(null);

  const alternarExpandido = (produtoId: string) => {
    setProdutoExpandidoId((atual) => (atual === produtoId ? null : produtoId));
  };

  // Categoria vem do cadastro (campo `categoria`, com fallback pro nome pros
  // itens ainda não categorizados) — a barra só mostra as categorias que
  // realmente têm produto, então sobremesas e bebidas aparecem sozinhas
  // assim que existir pelo menos 1 item cadastrado em cada uma.
  const categoriasDisponiveis = ORDEM_CATEGORIAS.filter((categoria) =>
    produtos.some((produto) => categoriaDoProduto(produto) === categoria.chave)
  );

  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaCantina>(
    categoriasDisponiveis[0]?.chave ?? 'PRATOS'
  );

  const produtosFiltrados = produtos.filter((produto) => categoriaDoProduto(produto) === categoriaAtiva);

  return (
    <div className="min-h-screen antialiased pb-32 font-sans select-none" style={{ backgroundColor: COR_CREME }}>
      <header className="relative z-20" style={{ backgroundColor: COR_MARROM }}>
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-6 py-4">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full" style={{ border: `1.5px solid ${COR_DOURADO}` }}>
            <Image src="/cantina-brasil-logo.jpg" alt="Cantina Brasil" width={36} height={36} className="h-full w-full object-cover" />
          </div>

          <span
            className={`${fonteExibicao.className} truncate px-3 text-center text-sm font-semibold uppercase tracking-[0.3em]`}
            style={{ color: COR_DOURADO_CLARO }}
          >
            Cantina Brasil
          </span>

          <Link href={`/${slug}/checkout`} className="relative shrink-0" style={{ color: COR_DOURADO_CLARO }} aria-label="Ver sacola">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
            </svg>
            {totalItens > 0 && (
              <span
                className="absolute -top-2 -right-2 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none"
                style={{ backgroundColor: COR_DOURADO_CLARO, color: COR_MARROM }}
              >
                {totalItens}
              </span>
            )}
          </Link>
        </div>
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${COR_DOURADO}, transparent)` }} />
      </header>

      <div className="border-b" style={{ backgroundColor: COR_CREME_ESCURO, borderColor: COR_LINHA }}>
        <div className="mx-auto w-full max-w-xl px-6 py-6 text-center">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.35em]" style={{ color: COR_MARROM_SUAVE }}>
            Comida Caseira
          </span>
          <p className={`${fonteExibicao.className} mt-2 text-lg italic sm:text-xl`} style={{ color: COR_MARROM }}>
            “O sabor de casa em cada prato”
          </p>
          <div className="mt-4">
            <DivisorOrnamental />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl px-6">
        <nav className="flex items-center gap-6 overflow-x-auto border-b pt-5 scrollbar-none" style={{ borderColor: COR_LINHA }}>
          {categoriasDisponiveis.map((categoria) => (
            <button
              key={categoria.chave}
              type="button"
              onClick={() => setCategoriaAtiva(categoria.chave)}
              className="shrink-0 pb-3 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors"
              style={
                categoriaAtiva === categoria.chave
                  ? { color: COR_MARROM, borderBottom: `2px solid ${COR_DOURADO}` }
                  : { color: '#B7A47D', borderBottom: '2px solid transparent' }
              }
            >
              {categoria.rotulo}
            </button>
          ))}
        </nav>

        <div className="mt-1">
          {produtosFiltrados.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-xs italic" style={{ color: COR_MARROM_SUAVE }}>
                Cardápio sendo preparado na cozinha — volte em breve.
              </p>
            </div>
          ) : (
            produtosFiltrados.map((produto) => (
              <LinhaProdutoCantina
                key={produto.id}
                produto={produto}
                expandido={produtoExpandidoId === produto.id}
                onToggleExpandir={() => alternarExpandido(produto.id)}
              />
            ))
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <DivisorOrnamental />
          <p className="text-[11px]" style={{ color: COR_MARROM_SUAVE }}>
            {restaurante.endereco?.trim() || 'Endereço do estabelecimento'}
          </p>
        </div>
      </div>

      <BarraCarrinhoFlutuante corBotaoAcao={COR_MARROM} corBadgeFundo={COR_DOURADO_CLARO} corBadgeTexto={COR_MARROM} />
    </div>
  );
}
