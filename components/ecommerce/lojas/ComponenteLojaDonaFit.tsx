'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';
import { resolverSlugLoja } from '@/utils/alias-vitrines';
import { obterConfigLojaEspecial } from '@/utils/config-lojas-especiais';
import FotoItem from '@/components/ecommerce/lojas/dona-fit/FotoItem';
import {
  NOME_MARCA,
  SLOGAN_MARCA,
  agruparPorCategoria,
  descreverMacros,
  ehSobEncomenda,
  extrairMacros,
  formatarMoeda,
} from '@/components/ecommerce/lojas/dona-fit/dados';

interface ComponenteLojaDonaFitProps {
  restaurante: { id: string; nome: string; endereco: string | null; logoUrl?: string | null };
  produtos: ItemCardapio[];
}

const COR_TEXTO = '#1E2A1E';
const COR_VERDE = '#A6C79A';
const COR_VERDE_ESCURO = '#4F7A42';
const COR_PILL = '#F0F4EA';
const COR_FUNDO_PAGINA = '#FFFFFF';

function FaixaOndas() {
  return (
    <svg className="block h-16 w-full" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden>
      <path d="M0,40 C60,10 100,55 160,32 C220,10 260,50 320,28 C350,18 380,30 400,24 L400,64 L0,64 Z" fill="#D8E4CF" />
      <path d="M0,50 C50,30 110,58 170,44 C230,30 280,56 340,40 C365,32 385,40 400,36 L400,64 L0,64 Z" fill="#E8F0E1" />
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
      <div className="flex items-center gap-2.5 rounded-full border border-zinc-200 bg-white p-1">
        <button
          type="button"
          onClick={() => onRemover(idUnicoCarrinho)}
          aria-label={`Remover uma unidade de ${produto.nome}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-50 text-base font-semibold text-zinc-600 hover:bg-zinc-100"
        >
          -
        </button>
        <span className="min-w-4 text-center font-mono text-sm font-semibold text-zinc-800" aria-live="polite">{qtd}</span>
        <button
          type="button"
          onClick={() => onAdicionar(produto, complementosSelecionados)}
          aria-label={`Adicionar mais uma unidade de ${produto.nome}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold text-white"
          style={{ backgroundColor: COR_VERDE_ESCURO }}
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
      aria-label={`Adicionar ${produto.nome} à sacola`}
      className="rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all active:scale-[0.98]"
      style={{ backgroundColor: COR_VERDE, color: COR_TEXTO }}
    >
      Adicionar
    </button>
  );
}

interface CartaoProdutoProps {
  produto: ItemCardapio;
  expandido: boolean;
  onToggleExpandir: () => void;
}

function CartaoProduto({ produto, expandido, onToggleExpandir }: CartaoProdutoProps) {
  const { adicionarItem, itens, removerItem } = useCarrinho();
  const [complementosSelecionadosIds, setComplementosSelecionadosIds] = useState<string[]>([]);

  const complementosDisponiveis = (produto.complementos_produto || []).filter((c) => c.disponivel);
  const { macros, texto } = extrairMacros(produto.descricao);

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
  const qtd = itens.find((item) => item.idUnico === idUnicoCarrinho)?.quantidade || 0;
  const valorComplementos = complementosSelecionados.reduce((acc, c) => acc + Number(c.preco_adicional), 0);
  const temComplementos = complementosDisponiveis.length > 0;

  const alternarComplemento = (id: string) => {
    setComplementosSelecionadosIds((atuais) =>
      atuais.includes(id) ? atuais.filter((itemId) => itemId !== id) : [...atuais, id]
    );
  };

  const corpo = (
    <>
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl" style={{ backgroundColor: COR_PILL }}>
        <FotoItem src={produto.imagem_url} alt={produto.nome} tamanho={64} />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-zinc-900">{produto.nome}</h3>
        {texto ? <p className="mt-1 line-clamp-2 text-xs font-light leading-snug text-zinc-500">{texto}</p> : null}
        {macros ? (
          <p className="mt-1 text-[11px] font-medium" style={{ color: COR_VERDE_ESCURO }}>
            {descreverMacros(macros)}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <span className="block font-mono text-sm font-semibold text-zinc-900">{formatarMoeda(Number(produto.preco_venda))}</span>
        {temComplementos ? (
          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide" style={{ color: COR_VERDE_ESCURO }}>
            {expandido ? 'fechar' : 'opções'}
          </span>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="border-b border-zinc-100 py-4 last:border-b-0">
      {temComplementos ? (
        <button type="button" onClick={onToggleExpandir} aria-expanded={expandido} className="flex w-full items-start gap-3 text-left">
          {corpo}
        </button>
      ) : (
        <div className="flex w-full items-start gap-3">{corpo}</div>
      )}

      {temComplementos && expandido ? (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Adicionais</span>
            <div className="grid grid-cols-2 gap-2">
              {complementosDisponiveis.map((complemento) => {
                const selecionado = complementosSelecionadosIds.includes(complemento.id);
                return (
                  <button
                    key={complemento.id}
                    type="button"
                    onClick={() => alternarComplemento(complemento.id)}
                    aria-pressed={selecionado}
                    className="rounded-full border px-3.5 py-2 text-center transition-all"
                    style={
                      selecionado
                        ? { backgroundColor: COR_VERDE_ESCURO, borderColor: COR_VERDE_ESCURO, color: '#fff' }
                        : { backgroundColor: '#fff', borderColor: '#DDE5D5', color: '#3f3f46' }
                    }
                  >
                    <span className="block text-[11px] font-medium leading-tight">{complemento.nome}</span>
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
      ) : null}

      {!temComplementos ? (
        <div className="mt-3 flex justify-end">
          <SeletorQuantidade qtd={qtd} idUnicoCarrinho={idUnicoCarrinho} produto={produto} complementosSelecionados={complementosSelecionados} onAdicionar={adicionarItem} onRemover={removerItem} />
        </div>
      ) : null}
    </div>
  );
}

export default function ComponenteLojaDonaFit({ restaurante, produtos }: ComponenteLojaDonaFitProps) {
  const params = useParams();
  const slug = resolverSlugLoja((params?.slug as string) || '');
  const { totalItens } = useCarrinho();
  const [produtoExpandidoId, setProdutoExpandidoId] = useState<string | null>(null);
  const grupos = useMemo(() => agruparPorCategoria(produtos), [produtos]);
  const [categoriaEscolhida, setCategoriaEscolhida] = useState<string | null>(null);

  const grupoAtivo = grupos.find((grupo) => grupo.nome === categoriaEscolhida) ?? grupos[0] ?? null;
  const whatsapp = obterConfigLojaEspecial(slug).whatsappAtendimento;
  const nomeMarca = restaurante.nome.split(' - ')[0].trim() || NOME_MARCA;

  const alternarExpandido = (produtoId: string) => {
    setProdutoExpandidoId((atual) => (atual === produtoId ? null : produtoId));
  };

  return (
    <div className="min-h-screen pb-32 font-sans antialiased" style={{ backgroundColor: COR_FUNDO_PAGINA, color: COR_TEXTO }}>
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-6 pt-6">
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full" style={{ backgroundColor: COR_PILL }}>
          <FotoItem src={restaurante.logoUrl} alt={`Logo ${nomeMarca}`} tamanho={40} placeholder="🌿" />
        </span>

        <Link href={`/${slug}/checkout`} className="relative p-1 text-zinc-800/70 transition-colors hover:text-zinc-900" aria-label="Ver sacola">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
          </svg>
          {totalItens > 0 ? (
            <span
              className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
              style={{ backgroundColor: COR_VERDE_ESCURO }}
            >
              {totalItens}
            </span>
          ) : null}
        </Link>
      </header>

      <div className="relative mx-auto w-full max-w-xl overflow-hidden px-6 pt-2">
        <h1 className="whitespace-nowrap text-[20vw] font-extrabold lowercase leading-[0.85] tracking-tighter sm:text-[6.5rem]" style={{ color: COR_TEXTO }}>
          {nomeMarca}
        </h1>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-400">{SLOGAN_MARCA}</span>
      </div>

      <div className="mx-auto mt-6 w-full max-w-xl px-6">
        <div className="space-y-1 text-sm font-light leading-relaxed text-zinc-600">
          <p>Alimentação saudável para o seu dia a dia</p>
          <p>Pratos feitos sob encomenda, com entrega agendada</p>
          <p>Entregas de segunda a sexta, das 8h às 19h</p>
        </div>

        <a
          href="#cardapio"
          className="mt-5 inline-flex items-center rounded-full px-6 py-2.5 text-xs font-semibold uppercase tracking-wider shadow-sm transition-all hover:brightness-95"
          style={{ backgroundColor: COR_VERDE, color: COR_TEXTO }}
        >
          Ver cardápio
        </a>
      </div>

      <div className="mt-8 w-full">
        <FaixaOndas />
      </div>

      <div id="cardapio" className="mx-auto mt-8 w-full max-w-xl scroll-mt-4 px-6">
        <nav className="mb-2 flex items-center gap-5 overflow-x-auto text-xs font-medium text-zinc-500 [scrollbar-width:none]" aria-label="Categorias">
          {grupos.map((grupo) => {
            const ativa = grupoAtivo?.nome === grupo.nome;
            return (
              <button
                key={grupo.id}
                type="button"
                onClick={() => setCategoriaEscolhida(grupo.nome)}
                aria-current={ativa ? 'true' : undefined}
                className="shrink-0 border-b-2 pb-2 uppercase tracking-wide transition-colors"
                style={ativa ? { borderColor: COR_TEXTO, color: COR_TEXTO } : { borderColor: 'transparent', color: '#a1a1aa' }}
              >
                {grupo.nome}
              </button>
            );
          })}
        </nav>

        {grupoAtivo && ehSobEncomenda(grupoAtivo.nome) ? (
          <p className="mb-1 mt-3 rounded-xl px-3.5 py-2.5 text-xs leading-snug" style={{ backgroundColor: COR_PILL, color: COR_VERDE_ESCURO }}>
            Feitos sob encomenda, entrega agendada.
          </p>
        ) : null}

        <div>
          {!grupoAtivo ? (
            <div className="py-16 text-center text-zinc-400">
              <p className="text-xs font-light">O cardápio está sendo atualizado. Volte em instantes.</p>
            </div>
          ) : (
            grupoAtivo.produtos.map((produto) => (
              <CartaoProduto
                key={produto.id}
                produto={produto}
                expandido={produtoExpandidoId === produto.id}
                onToggleExpandir={() => alternarExpandido(produto.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-xl space-y-2 px-6 text-center text-[11px] font-light text-zinc-400">
        <p>{restaurante.endereco?.trim() || 'Endereço do estabelecimento'}</p>
        {whatsapp ? (
          <a
            href={`https://wa.me/55${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-medium underline underline-offset-2"
            style={{ color: COR_VERDE_ESCURO }}
          >
            Falar com a loja no WhatsApp
          </a>
        ) : null}
      </div>

      <BarraCarrinhoFlutuante corBotaoAcao={COR_VERDE_ESCURO} corBadgeFundo={COR_VERDE} corBadgeTexto={COR_TEXTO} />
    </div>
  );
}
