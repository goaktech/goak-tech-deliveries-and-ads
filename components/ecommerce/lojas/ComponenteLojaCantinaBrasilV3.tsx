'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bitter, Public_Sans } from 'next/font/google';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';
import {
  categoriaDoProduto,
  produtoDisponivelHoje,
  rotuloDiaSemana,
  type CategoriaCantina,
} from '@/utils/cardapio-cantina-brasil';
import {
  obterDiaSemanaAtualBrasil,
  obterStatusFuncionamento,
  type HorarioFuncionamentoDia,
} from '@/utils/horario-funcionamento';

const fonteExibicao = Bitter({ subsets: ['latin'], weight: ['600', '700'] });
const fonteCorpo = Public_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

interface ComponenteLojaCantinaBrasilV3Props {
  restaurante: {
    id: string;
    nome: string;
    endereco: string | null;
    horariosFuncionamento?: HorarioFuncionamentoDia[] | null;
  };
  produtos: ItemCardapio[];
}

/* =============================================================
   Paleta "Tropical Azulejo" v3 — extraída da própria logo da loja
   (anel/letras douradas, telhado da casinha em terracota, faixa
   escura "Comida Caseira" em verde-oliva na versão final aprovada).
   ============================================================= */
const COR_INK = '#3F4A2A'; // superfícies escuras: header, hero, botões, barra do carrinho
const COR_TEXTO = '#2A1710'; // texto padrão sobre fundo claro
const COR_TEXTO_SUAVE = '#5C4A3A';
const COR_MUTED = '#A08F76';
const COR_DOURADO = '#F2A30C'; // anel/letras do logo
const COR_DOURADO_CLARO = '#FFC65A'; // texto dourado pequeno sobre fundo escuro (contraste)
const COR_TERRACOTA = '#8C4A2A'; // telhado da casinha / borda da tigela, no logo
const COR_CREME = '#FBF7EF';
const COR_CREME_2 = '#F3E8D4';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* ---------- padrão decorativo tipo azulejo, em tom dourado sobre o fundo escuro ---------- */
function PadraoAzulejo() {
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, opacity: 0.16 }}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern id="azulejo-v3" width="44" height="44" patternUnits="userSpaceOnUse">
          <rect width="44" height="44" fill="none" />
          <path d="M22 2 L42 22 L22 42 L2 22 Z" fill="none" stroke={COR_DOURADO} strokeWidth="1" />
          <circle cx="22" cy="22" r="4" fill="none" stroke={COR_DOURADO} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#azulejo-v3)" />
    </svg>
  );
}

function IconeSacola({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
      />
    </svg>
  );
}

/* ---------- ícones de categoria (linha) — sem acompanhamentos, que saiu da v3 ---------- */
function IconeCategoria({
  categoria,
  className,
  style,
}: {
  categoria: CategoriaCantina;
  className?: string;
  style?: React.CSSProperties;
}) {
  const CAMINHOS: Partial<Record<CategoriaCantina, React.ReactNode>> = {
    PRATOS: (
      <>
        <path d="M6 15h20v9a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 6 24Z" />
        <path d="M6 15v-2.5A2.5 2.5 0 0 1 8.5 10h15A2.5 2.5 0 0 1 26 12.5V15" />
        <path d="M12 10V6.5M20 10V6.5" />
      </>
    ),
    BEBIDAS: (
      <>
        <path d="M9 10h14l-1.6 17H10.6z" />
        <path d="M9.6 15h12.8" />
        <path d="M12 10l1.6-4H20" />
      </>
    ),
    SOBREMESAS: (
      <>
        <path d="M11 13h10l-2.2 14h-5.6z" />
        <path d="M10 13a6 6 0 0 1 12 0" />
        <path d="M16 7V4" />
      </>
    ),
  };

  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {CAMINHOS[categoria]}
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
  /** 'claro' = botão marrom-oliva sobre fundo creme · 'escuro' = botão dourado sobre o card escuro do herói */
  variante?: 'claro' | 'escuro';
}

function SeletorQuantidade({
  qtd,
  idUnicoCarrinho,
  produto,
  complementosSelecionados,
  onAdicionar,
  onRemover,
  variante = 'claro',
}: SeletorQuantidadeProps) {
  const corBorda = variante === 'escuro' ? 'rgba(255,255,255,0.55)' : COR_INK;
  const corTexto = variante === 'escuro' ? '#fff' : COR_INK;
  const corBotaoPreenchido = variante === 'escuro' ? COR_DOURADO : COR_INK;
  const corTextoPreenchido = variante === 'escuro' ? COR_INK : '#fff';

  if (qtd > 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-full px-1 py-1" style={{ border: `1.5px solid ${corBorda}` }}>
        <button
          type="button"
          onClick={() => onRemover(idUnicoCarrinho)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold"
          style={{ color: corTexto }}
          aria-label="Remover um"
        >
          −
        </button>
        <span className="min-w-[1ch] text-center text-sm font-bold" style={{ color: corTexto }}>
          {qtd}
        </span>
        <button
          type="button"
          onClick={() => onAdicionar(produto, complementosSelecionados)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold"
          style={{ backgroundColor: corBotaoPreenchido, color: corTextoPreenchido }}
          aria-label="Adicionar mais um"
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
      className="rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: corBotaoPreenchido, color: corTextoPreenchido }}
    >
      Adicionar
    </button>
  );
}

/** Prato do dia fora do seu dia da semana: mostra quando ele volta em vez do botão de adicionar. */
function EtiquetaForaDoDia({ diaSemana, variante = 'claro' }: { diaSemana: number; variante?: 'claro' | 'escuro' }) {
  const cor = variante === 'escuro' ? '#fff' : COR_TEXTO_SUAVE;
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide"
      style={{ border: `1.25px dashed ${cor}`, color: cor }}
    >
      Disponível {rotuloDiaSemana(diaSemana)}
    </span>
  );
}

interface LinhaProdutoCantinaV3Props {
  produto: ItemCardapio;
  expandido: boolean;
  onToggleExpandir: () => void;
}

/** Linha de item reutilizada pelas seções Bebidas, Sobremesas e Pratos da semana. */
function LinhaProdutoCantinaV3({ produto, expandido, onToggleExpandir }: LinhaProdutoCantinaV3Props) {
  const { adicionarItem, itens, removerItem } = useCarrinho();
  const [complementosSelecionadosIds, setComplementosSelecionadosIds] = useState<string[]>([]);

  const categoria = categoriaDoProduto(produto);
  // Só os PRATOS (pratos do dia) têm restrição de dia da semana; os demais
  // ficam sempre disponíveis, igual já era na v1/v2.
  const disponivelHoje = categoria !== 'PRATOS' || produtoDisponivelHoje(produto);

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
    <div className="border-b py-3.5" style={{ borderColor: 'rgba(42,23,16,0.08)' }}>
      <div className="flex gap-3">
        <div
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{ backgroundColor: COR_CREME_2 }}
        >
          {produto.imagem_url ? (
            <Image
              src={produto.imagem_url}
              alt={produto.nome}
              width={50}
              height={50}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <IconeCategoria categoria={categoria} className="h-[21px] w-[21px]" style={{ color: COR_TERRACOTA }} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-[13.5px] font-bold" style={{ color: COR_TEXTO }} title={produto.nome}>
              {produto.nome}
            </h3>
            <span className="shrink-0 text-[13px] font-bold" style={{ color: COR_TERRACOTA }}>
              {formatarMoeda(Number(produto.preco_venda))}
            </span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: COR_MUTED }}>
            {produto.descricao || 'Feito em casa, todo dia.'}
          </p>

          <div className="mt-2 flex items-center justify-between">
            {temComplementos ? (
              <button
                type="button"
                onClick={onToggleExpandir}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide"
                style={{ color: COR_TEXTO_SUAVE }}
              >
                {expandido ? 'Ocultar adicionais' : 'Ver adicionais'}
                <svg
                  className={`h-3 w-3 transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke={COR_TEXTO_SUAVE}
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            ) : (
              <span />
            )}

            {!temComplementos &&
              (disponivelHoje ? (
                <SeletorQuantidade
                  qtd={qtd}
                  idUnicoCarrinho={idUnicoCarrinho}
                  produto={produto}
                  complementosSelecionados={complementosSelecionados}
                  onAdicionar={adicionarItem}
                  onRemover={removerItem}
                />
              ) : (
                <EtiquetaForaDoDia diaSemana={produto.dia_semana as number} />
              ))}
          </div>
        </div>
      </div>

      {expandido && temComplementos && (
        <div
          className="animate-in fade-in mt-3 space-y-3 rounded-2xl border px-3 py-3 duration-200"
          style={{ borderColor: 'rgba(42,23,16,0.12)', backgroundColor: COR_CREME_2 }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: COR_TERRACOTA }}>
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
                      ? { backgroundColor: COR_INK, color: '#fff', border: `1.5px solid ${COR_INK}` }
                      : { backgroundColor: '#fff', color: COR_TEXTO, border: '1.5px solid rgba(42,23,16,0.15)' }
                  }
                >
                  {complemento.nome}
                  <span className={selecionado ? 'ml-1 text-white/80' : 'ml-1'} style={selecionado ? undefined : { color: COR_TEXTO_SUAVE }}>
                    +{formatarMoeda(Number(complemento.preco_adicional))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs" style={{ color: COR_TEXTO_SUAVE }}>
              {complementosSelecionados.length > 0 && (
                <>
                  Adicionais <span className="font-bold" style={{ color: COR_TEXTO }}>+{formatarMoeda(valorComplementos)}</span>
                </>
              )}
            </div>
            {disponivelHoje ? (
              <SeletorQuantidade
                qtd={qtd}
                idUnicoCarrinho={idUnicoCarrinho}
                produto={produto}
                complementosSelecionados={complementosSelecionados}
                onAdicionar={adicionarItem}
                onRemover={removerItem}
              />
            ) : (
              <EtiquetaForaDoDia diaSemana={produto.dia_semana as number} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Botão de adicionar do herói "prato do dia" — fora do card genérico porque usa fundo escuro. */
function ProdutoDestaqueBotao({ produto }: { produto: ItemCardapio }) {
  const { adicionarItem, itens, removerItem } = useCarrinho();
  const itemNoCarrinho = itens.find((item) => item.idUnico === produto.id);
  const qtd = itemNoCarrinho?.quantidade || 0;

  return (
    <SeletorQuantidade
      qtd={qtd}
      idUnicoCarrinho={produto.id}
      produto={produto}
      complementosSelecionados={[]}
      onAdicionar={adicionarItem}
      onRemover={removerItem}
      variante="escuro"
    />
  );
}

const SECOES_NAV = [
  { id: 'hoje', rotulo: 'Prato do dia' },
  { id: 'bebidas', rotulo: 'Bebidas' },
  { id: 'sobremesas', rotulo: 'Sobremesas' },
  { id: 'pratos-da-semana', rotulo: 'Pratos da semana' },
] as const;

export default function ComponenteLojaCantinaBrasilV3({ restaurante, produtos }: ComponenteLojaCantinaBrasilV3Props) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens } = useCarrinho();
  const [produtoExpandidoId, setProdutoExpandidoId] = useState<string | null>(null);

  const alternarExpandido = (produtoId: string) => {
    setProdutoExpandidoId((atual) => (atual === produtoId ? null : produtoId));
  };

  const diaHoje = obterDiaSemanaAtualBrasil();
  const status = obterStatusFuncionamento(restaurante.horariosFuncionamento, new Date());

  const pratos = produtos.filter((p) => categoriaDoProduto(p) === 'PRATOS' && p.dia_semana !== null && p.dia_semana !== undefined);
  const bebidas = produtos.filter((p) => categoriaDoProduto(p) === 'BEBIDAS');
  const sobremesas = produtos.filter((p) => categoriaDoProduto(p) === 'SOBREMESAS');

  // "Prato do momento": o prato do dia cujo dia_semana bate com hoje. Some
  // sozinho (sem herói) se nenhum prato estiver cadastrado pra hoje.
  const produtoDestaque = pratos.find((p) => produtoDisponivelHoje(p));

  // Pratos da semana, ordenados de domingo a sábado, pra tira e pra seção final.
  const pratosPorDia = [...pratos].sort((a, b) => (a.dia_semana as number) - (b.dia_semana as number));

  return (
    <div className={`${fonteCorpo.className} min-h-screen w-full`} style={{ backgroundColor: COR_CREME }}>
      <div className="relative mx-auto min-h-screen w-full max-w-[560px] select-none pb-32 antialiased" style={{ backgroundColor: COR_CREME }}>

        {/* ---------- header ---------- */}
        <header className="relative overflow-hidden px-6 pb-8 pt-7 text-center" style={{ backgroundColor: COR_INK }}>
          <PadraoAzulejo />

          <Link
            href={`/${slug}/checkout`}
            className="absolute right-6 top-6 z-[1] flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(242,163,12,0.16)', color: COR_CREME }}
            aria-label="Ver sacola"
          >
            <IconeSacola className="h-4 w-4" />
            {totalItens > 0 && (
              <span
                className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
                style={{ backgroundColor: COR_DOURADO, color: COR_INK }}
              >
                {totalItens}
              </span>
            )}
          </Link>

          <div className="relative z-[1]">
            <div
              className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full"
              style={{ border: `3px solid ${COR_DOURADO}`, boxShadow: '0 10px 22px rgba(0,0,0,0.35)' }}
            >
              <Image src="/cantina-brasil-logo.jpg" alt={restaurante.nome || 'Cantina Brasil'} width={80} height={80} className="h-full w-full object-cover" />
            </div>
            <h1 className={`${fonteExibicao.className} mt-4 text-[22px] font-bold`} style={{ color: COR_DOURADO }}>
              {restaurante.nome || 'Cantina Brasil'}
            </h1>
            <p className="mt-1 text-xs font-semibold" style={{ color: '#E7C892' }}>
              O sabor de casa em cada prato
            </p>
          </div>
        </header>

        {/* ---------- tarja de confiança: horário real + endereço ---------- */}
        <div className="flex flex-wrap items-center justify-center gap-2 px-6 py-2.5" style={{ backgroundColor: COR_CREME_2 }}>
          <span className="flex items-center gap-1.5 text-[10.5px] font-bold" style={{ color: COR_TEXTO }}>
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: status.aberto ? '#5C7A46' : '#B4552F' }}
            />
            {status.texto}
          </span>
          {restaurante.endereco?.trim() && (
            <>
              <span className="text-[10px]" style={{ color: COR_TERRACOTA }}>•</span>
              <span className="text-[10.5px] font-semibold" style={{ color: COR_TEXTO_SUAVE }}>
                {restaurante.endereco}
              </span>
            </>
          )}
        </div>

        {/* ---------- nav ---------- */}
        <nav
          className="sticky top-0 z-30 flex gap-2 overflow-x-auto px-5 py-3.5 scrollbar-none"
          style={{ backgroundColor: COR_CREME, borderBottom: '1px solid rgba(42,23,16,0.1)' }}
        >
          {SECOES_NAV.map((secao) => (
            <a
              key={secao.id}
              href={`#${secao.id}`}
              className="shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold"
              style={{ backgroundColor: COR_CREME_2, color: COR_TEXTO }}
            >
              {secao.rotulo}
            </a>
          ))}
        </nav>

        <main className="px-6 pb-2">

          {/* ---------- prato do dia (herói) ---------- */}
          <section id="hoje" style={{ scrollMarginTop: 66 }}>
            {produtoDestaque ? (
              <div className="relative overflow-hidden rounded-[18px] p-5 text-white" style={{ backgroundColor: COR_INK }}>
                <span
                  className="mb-3 inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
                  style={{ backgroundColor: COR_DOURADO, color: COR_INK }}
                >
                  {rotuloDiaSemana(diaHoje)} · Hoje
                </span>
                <div className="mb-4 flex items-start gap-3.5">
                  <div
                    className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-2xl"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                  >
                    {produtoDestaque.imagem_url ? (
                      <Image
                        src={produtoDestaque.imagem_url}
                        alt={produtoDestaque.nome}
                        width={92}
                        height={92}
                        unoptimized
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <IconeCategoria categoria="PRATOS" className="h-[34px] w-[34px]" style={{ color: COR_DOURADO }} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-grow text-right">
                    <h2 className={`${fonteExibicao.className} mb-1.5 text-[21px] font-bold`}>{produtoDestaque.nome}</h2>
                    <p className="text-[12.5px] leading-snug" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {produtoDestaque.descricao || 'Feito em casa, todo dia.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`${fonteExibicao.className} text-[19px] font-bold`} style={{ color: COR_DOURADO }}>
                    {formatarMoeda(Number(produtoDestaque.preco_venda))}
                  </span>
                  <ProdutoDestaqueBotao produto={produtoDestaque} />
                </div>
              </div>
            ) : (
              <div className="rounded-[18px] p-5 text-center" style={{ backgroundColor: COR_CREME_2 }}>
                <p className="text-xs italic" style={{ color: COR_TEXTO_SUAVE }}>
                  Nenhum prato do dia cadastrado pra hoje — dá uma olhada nos pratos da semana mais abaixo.
                </p>
              </div>
            )}

            {/* tira compacta com a semana inteira, prato-a-prato */}
            {pratosPorDia.length > 0 && (
              <div className="mt-4">
                <span className="mb-2 block text-[10.5px] font-bold uppercase tracking-wide" style={{ color: COR_TEXTO_SUAVE }}>
                  Cardápio da semana
                </span>
                <div className="flex gap-2 overflow-x-auto pb-0.5">
                  {pratosPorDia.map((prato) => {
                    const ehHoje = prato.dia_semana === diaHoje;
                    return (
                      <div
                        key={prato.id}
                        className="w-[88px] shrink-0 rounded-xl p-2.5"
                        style={{ backgroundColor: ehHoje ? COR_INK : COR_CREME_2 }}
                      >
                        <span
                          className="block text-[9px] font-extrabold"
                          style={{ color: ehHoje ? COR_DOURADO_CLARO : COR_MUTED }}
                        >
                          {rotuloDiaSemana(prato.dia_semana as number).slice(0, 3).toUpperCase()}
                        </span>
                        <span
                          className="mt-1 block truncate text-[10.5px] font-semibold"
                          style={{ color: ehHoje ? '#fff' : COR_TEXTO }}
                          title={prato.nome}
                        >
                          {prato.nome}
                        </span>
                        <span
                          className="mt-1 block text-[10px] font-bold"
                          style={{ color: ehHoje ? COR_DOURADO_CLARO : COR_TEXTO_SUAVE }}
                        >
                          {ehHoje ? 'Hoje' : formatarMoeda(Number(prato.preco_venda))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ---------- bebidas ---------- */}
          {bebidas.length > 0 && (
            <section id="bebidas" style={{ scrollMarginTop: 66, marginTop: 30 }}>
              <div className="mb-1 flex items-center gap-2.5">
                <h2 className={`${fonteExibicao.className} text-[16px] font-bold`} style={{ color: COR_TEXTO }}>
                  Bebidas
                </h2>
                <span className="h-px flex-grow" style={{ backgroundColor: 'rgba(242,163,12,0.4)' }} />
              </div>
              {bebidas.map((produto) => (
                <LinhaProdutoCantinaV3
                  key={produto.id}
                  produto={produto}
                  expandido={produtoExpandidoId === produto.id}
                  onToggleExpandir={() => alternarExpandido(produto.id)}
                />
              ))}
            </section>
          )}

          {/* ---------- sobremesas ---------- */}
          {sobremesas.length > 0 && (
            <section id="sobremesas" style={{ scrollMarginTop: 66, marginTop: 26 }}>
              <div className="mb-1 flex items-center gap-2.5">
                <h2 className={`${fonteExibicao.className} text-[16px] font-bold`} style={{ color: COR_TEXTO }}>
                  Sobremesas
                </h2>
                <span className="h-px flex-grow" style={{ backgroundColor: 'rgba(242,163,12,0.4)' }} />
              </div>
              {sobremesas.map((produto) => (
                <LinhaProdutoCantinaV3
                  key={produto.id}
                  produto={produto}
                  expandido={produtoExpandidoId === produto.id}
                  onToggleExpandir={() => alternarExpandido(produto.id)}
                />
              ))}
            </section>
          )}

          {/* ---------- pratos da semana (seção completa, sempre a última) ---------- */}
          {pratosPorDia.length > 0 && (
            <section id="pratos-da-semana" style={{ scrollMarginTop: 66, marginTop: 26 }}>
              <div className="mb-1 flex items-center gap-2.5">
                <h2 className={`${fonteExibicao.className} text-[16px] font-bold`} style={{ color: COR_TEXTO }}>
                  Pratos da semana
                </h2>
                <span className="h-px flex-grow" style={{ backgroundColor: 'rgba(242,163,12,0.4)' }} />
              </div>
              {pratosPorDia.map((produto) => (
                <LinhaProdutoCantinaV3
                  key={produto.id}
                  produto={produto}
                  expandido={produtoExpandidoId === produto.id}
                  onToggleExpandir={() => alternarExpandido(produto.id)}
                />
              ))}
            </section>
          )}

          {produtos.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-xs italic" style={{ color: COR_TEXTO_SUAVE }}>
                Cardápio sendo preparado na cozinha — volte em breve.
              </p>
            </div>
          )}
        </main>

        <BarraCarrinhoFlutuante corBotaoAcao={COR_INK} corBadgeFundo={COR_DOURADO} corBadgeTexto={COR_INK} />
      </div>
    </div>
  );
}
