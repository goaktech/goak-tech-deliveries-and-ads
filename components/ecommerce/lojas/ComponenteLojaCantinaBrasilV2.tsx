'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Baloo_2, Caveat } from 'next/font/google';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';
import {
  categoriaDoProduto,
  produtoDisponivelHoje,
  rotuloDiaSemana,
  type CategoriaCantina,
} from '@/utils/cardapio-cantina-brasil';

const fonteExibicao = Baloo_2({ subsets: ['latin'], weight: ['600', '700', '800'] });
const fonteManuscrita = Caveat({ subsets: ['latin'], weight: ['600', '700'] });

interface ComponenteLojaCantinaBrasilV2Props {
  restaurante: { id: string; nome: string; endereco: string | null };
  produtos: ItemCardapio[];
}

/* =============================================================
   Paleta — mesmas cores do Royal Burguer (--ink, --ink-soft, --brown,
   --brown-soft, --gold, --cream, --cream-2 do style.css original),
   só trocando a foto do lanche pela identidade da Cantina Brasil.
   ============================================================= */
const COR_MARROM = '#3b2011'; // --ink
const COR_MARROM_SUAVE = '#6b4a33'; // --ink-soft
const COR_PAINEL = '#b15e33'; // --brown-soft (painel do card do prato + pill de categoria inativa)
const COR_PAINEL_TEXTO = '#ffffff'; // --white (texto sobre o painel marrom)
const COR_DOURADO = '#f4a93c'; // --gold
const COR_CREME = '#f6efe0'; // --cream
const COR_CREME_ESCURO = '#efe3cc'; // --cream-2
const COR_TERRACOTA = '#9e4a1f'; // --brown
const COR_LINHA = 'rgba(107, 74, 51, 0.25)'; // --ink-soft com opacidade, pra bordas/divisores sutis
const COR_FUNDO_PAGINA = '#e9dcc4'; // "mesa" atrás do cardápio em telas largas — igual ao body do Royal Burguer
const SOMBRA = '0 10px 26px rgba(59, 32, 17, 0.16)'; // --shadow
const SOMBRA_FOTO = '0 14px 16px rgba(59, 32, 17, 0.4)';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function IconeFolha({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke={COR_TERRACOTA} strokeWidth="1.4" aria-hidden>
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

/* ---------- ícones de categoria (linha, combinam com a identidade) ---------- */
function IconeCategoria({
  categoria,
  className,
  style,
}: {
  categoria: CategoriaCantina;
  className?: string;
  style?: React.CSSProperties;
}) {
  const CAMINHOS: Record<CategoriaCantina, React.ReactNode> = {
    PRATOS: (
      <>
        <path d="M6 15h20v9a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 6 24Z" />
        <path d="M6 15v-2.5A2.5 2.5 0 0 1 8.5 10h15A2.5 2.5 0 0 1 26 12.5V15" />
        <path d="M12 10V6.5M20 10V6.5" />
      </>
    ),
    ACOMPANHAMENTOS: (
      <>
        <path d="M5 16h22a11 11 0 0 1-22 0Z" />
        <path d="M10.5 16c0-3.2 1.5-5.4 1.5-5.4M16 16c0-4.2 0-7.4-1-9.6M21.5 16c0-3.2-1.5-5.4-1.5-5.4" />
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

const EMOJI_CATEGORIA: Record<CategoriaCantina, string> = {
  PRATOS: '🍱',
  ACOMPANHAMENTOS: '🥗',
  BEBIDAS: '🥤',
  SOBREMESAS: '🍮',
};

interface SeletorQuantidadeProps {
  qtd: number;
  idUnicoCarrinho: string;
  produto: ItemCardapio;
  complementosSelecionados: Complemento[];
  onAdicionar: (produto: ItemCardapio, complementos: Complemento[]) => void;
  onRemover: (idUnico: string) => void;
  /** 'claro' = para usar sobre fundo creme/branco · 'escuro' = para usar sobre o painel marrom do card */
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
  const corBorda = variante === 'escuro' ? 'rgba(255, 255, 255, 0.55)' : COR_MARROM;
  const corTexto = variante === 'escuro' ? COR_PAINEL_TEXTO : COR_MARROM;
  const corBotaoPreenchido = variante === 'escuro' ? COR_DOURADO : COR_MARROM;
  const corTextoPreenchido = variante === 'escuro' ? COR_MARROM : '#fff';

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
      className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: corBotaoPreenchido, color: corTextoPreenchido }}
    >
      Adicionar
    </button>
  );
}

/** Prato do dia fora do dia dele: mostra quando ele volta em vez do botão de adicionar. */
function EtiquetaForaDoDia({ diaSemana, variante = 'claro' }: { diaSemana: number; variante?: 'claro' | 'escuro' }) {
  const cor = variante === 'escuro' ? COR_PAINEL_TEXTO : COR_MARROM_SUAVE;
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide"
      style={{ border: `1.25px dashed ${cor}`, color: cor }}
    >
      Disponível {rotuloDiaSemana(diaSemana)}
    </span>
  );
}

interface CartaoPratoCantinaProps {
  produto: ItemCardapio;
  emojiCategoria: string;
  expandido: boolean;
  onToggleExpandir: () => void;
}

function CartaoPratoCantina({ produto, emojiCategoria, expandido, onToggleExpandir }: CartaoPratoCantinaProps) {
  const { adicionarItem, itens, removerItem } = useCarrinho();
  const [complementosSelecionadosIds, setComplementosSelecionadosIds] = useState<string[]>([]);

  const categoria = categoriaDoProduto(produto);
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
    <article className="relative mb-7 ml-[18px] flex min-h-[150px] flex-col justify-center pl-[118px]">
      {/* foto em "blob" orgânico, sangrando pra esquerda e por cima do painel — mesma ideia do Royal Burguer */}
      <div
        className="absolute -left-[18px] top-1/2 z-[2] h-[142px] w-[142px] -translate-y-1/2 overflow-hidden rounded-[38%_38%_38%_12%]"
        style={{ boxShadow: SOMBRA_FOTO }}
      >
        {produto.imagem_url ? (
          <Image
            src={produto.imagem_url}
            alt={produto.nome}
            width={142}
            height={142}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: 'radial-gradient(circle at 38% 30%, #ffe0b0, #e2a860 65%, #c67d43)' }}
          >
            <span className="text-4xl" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.22))' }} aria-hidden>
              {emojiCategoria}
            </span>
          </div>
        )}
      </div>

      <h3
        className={`${fonteExibicao.className} mb-1.5 truncate pr-8 text-right text-[15px] font-bold leading-tight`}
        style={{ color: COR_MARROM }}
        title={produto.nome}
      >
        {produto.nome}
      </h3>

      {/* painel puxado pra trás (-ml) pra passar por baixo da foto, com o canto
          superior esquerdo bem arredondado pra "abraçar" o blob — o z-index
          menor que o da foto garante que ela fique por cima na sobreposição */}
      <div
        className="relative z-[1] ml-[-64px] min-h-[108px] rounded-[34px_18px_18px_18px] py-3 pl-[78px] pr-4"
        style={{ backgroundColor: COR_PAINEL, boxShadow: SOMBRA }}
      >
        <p className="text-[13px] leading-snug" style={{ color: COR_PAINEL_TEXTO }}>
          {produto.descricao || 'Feito em casa, todo dia.'}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold" style={{ color: '#ffe6bf' }}>
            {formatarMoeda(Number(produto.preco_venda))}
          </span>
          {!temComplementos && (
            disponivelHoje ? (
              <SeletorQuantidade
                qtd={qtd}
                idUnicoCarrinho={idUnicoCarrinho}
                produto={produto}
                complementosSelecionados={complementosSelecionados}
                onAdicionar={adicionarItem}
                onRemover={removerItem}
                variante="escuro"
              />
            ) : (
              <EtiquetaForaDoDia diaSemana={produto.dia_semana as number} variante="escuro" />
            )
          )}
        </div>
      </div>

      {temComplementos && (
        <button
          type="button"
          onClick={onToggleExpandir}
          className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide"
          style={{ color: COR_MARROM_SUAVE }}
        >
          {expandido ? 'Ocultar adicionais' : 'Ver adicionais'}
          <svg
            className={`h-3 w-3 transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`}
            fill="none"
            stroke={COR_MARROM_SUAVE}
            strokeWidth="2.5"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      )}

      {expandido && temComplementos && (
        <div className="animate-in fade-in mt-2 space-y-3 rounded-2xl border px-3 py-3 duration-200" style={{ borderColor: COR_LINHA, backgroundColor: COR_CREME_ESCURO }}>
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
                      ? { backgroundColor: COR_MARROM, color: '#fff', border: `1.5px solid ${COR_MARROM}` }
                      : { backgroundColor: '#fff', color: COR_MARROM, border: `1.5px solid ${COR_LINHA}` }
                  }
                >
                  {complemento.nome}
                  <span className={selecionado ? 'ml-1 text-white/80' : 'ml-1'} style={selecionado ? undefined : { color: COR_MARROM_SUAVE }}>
                    +{formatarMoeda(Number(complemento.preco_adicional))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs" style={{ color: COR_MARROM_SUAVE }}>
              {complementosSelecionados.length > 0 && (
                <>
                  Adicionais <span className="font-bold" style={{ color: COR_MARROM }}>+{formatarMoeda(valorComplementos)}</span>
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
                variante="claro"
              />
            ) : (
              <EtiquetaForaDoDia diaSemana={produto.dia_semana as number} variante="claro" />
            )}
          </div>
        </div>
      )}
    </article>
  );
}

const ORDEM_CATEGORIAS: { chave: CategoriaCantina; rotulo: string }[] = [
  { chave: 'PRATOS', rotulo: 'Pratos do Dia' },
  { chave: 'ACOMPANHAMENTOS', rotulo: 'Acompanhamentos' },
  { chave: 'BEBIDAS', rotulo: 'Bebidas' },
  { chave: 'SOBREMESAS', rotulo: 'Sobremesas' },
];

export default function ComponenteLojaCantinaBrasilV2({ restaurante, produtos }: ComponenteLojaCantinaBrasilV2Props) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens } = useCarrinho();
  const [produtoExpandidoId, setProdutoExpandidoId] = useState<string | null>(null);

  const alternarExpandido = (produtoId: string) => {
    setProdutoExpandidoId((atual) => (atual === produtoId ? null : produtoId));
  };

  // só mostra na barra as categorias que realmente têm produto cadastrado
  const categoriasDisponiveis = ORDEM_CATEGORIAS.filter((categoria) =>
    produtos.some((produto) => categoriaDoProduto(produto) === categoria.chave)
  );

  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaCantina>(
    categoriasDisponiveis[0]?.chave ?? 'PRATOS'
  );

  const produtosFiltrados = produtos.filter((produto) => categoriaDoProduto(produto) === categoriaAtiva);

  // "Prato do Momento": destaca automaticamente o prato do dia de hoje (o
  // item de categoria PRATOS cujo dia_semana bate com hoje) — sem precisar
  // configurar nada manualmente. Some sozinho quando nenhum prato do dia
  // estiver cadastrado pra hoje.
  const produtoDestaque = produtos.find(
    (produto) =>
      categoriaDoProduto(produto) === 'PRATOS' &&
      produto.dia_semana !== null &&
      produto.dia_semana !== undefined &&
      produtoDisponivelHoje(produto)
  );

  return (
    // moldura "celular" centralizada — mesma ideia do Royal Burguer (.phone,
    // fundo contrastante nas laterais em telas largas). Um pouco mais larga
    // que o --app original (480px) pra aproveitar melhor telas de desktop.
    // Sem essa moldura o cardápio esticava a largura inteira da tela em
    // desktop e o card do prato (foto-blob + painel compacto) ficava deformado.
    <div className="min-h-screen w-full" style={{ backgroundColor: COR_FUNDO_PAGINA }}>
      <div
        className="relative mx-auto min-h-screen w-full max-w-[560px] select-none pb-32 antialiased"
        style={{ backgroundColor: COR_CREME, boxShadow: '0 0 60px rgba(59, 32, 17, 0.18)' }}
      >
      {/* ---------- herói: identidade da marca, no lugar da foto do Royal Burguer ---------- */}
      <header
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${COR_MARROM} 0%, #6E3A1E 55%, ${COR_TERRACOTA} 100%)` }}
      >
        <div className="relative mx-auto w-full max-w-xl px-6 pb-8 pt-6 text-center">
          <Link
            href={`/${slug}/checkout`}
            className="absolute right-6 top-6 rounded-full p-2"
            style={{ backgroundColor: 'rgba(246, 239, 224, 0.14)', color: COR_CREME }}
            aria-label="Ver sacola"
          >
            <IconeSacola className="h-5 w-5" />
            {totalItens > 0 && (
              <span
                className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
                style={{ backgroundColor: COR_DOURADO, color: COR_MARROM }}
              >
                {totalItens}
              </span>
            )}
          </Link>

          <div
            className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full"
            style={{ border: `3px solid ${COR_DOURADO}`, boxShadow: SOMBRA }}
          >
            <Image
              src="/cantina-brasil-logo.jpg"
              alt={restaurante.nome || 'Cantina Brasil'}
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
          </div>

          <h1 className={`${fonteExibicao.className} mt-4 text-3xl font-extrabold uppercase leading-tight`} style={{ color: COR_CREME }}>
            {restaurante.nome || 'Cantina Brasil'}
          </h1>
          <p className={`${fonteManuscrita.className} mt-1 text-xl`} style={{ color: COR_DOURADO }}>
            &ldquo;O sabor de casa em cada prato&rdquo;
          </p>
        </div>
      </header>

      {/* ---------- barra de categorias (sticky) ---------- */}
      {categoriasDisponiveis.length > 1 && (
        <nav
          className="sticky top-0 z-30 flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none"
          style={{ backgroundColor: COR_CREME, boxShadow: '0 6px 14px rgba(59, 32, 17, 0.08)' }}
        >
          {categoriasDisponiveis.map((categoria) => {
            const ativa = categoriaAtiva === categoria.chave;
            return (
              <button
                key={categoria.chave}
                type="button"
                onClick={() => setCategoriaAtiva(categoria.chave)}
                className="flex shrink-0 flex-col items-center gap-1"
              >
                <IconeCategoria
                  categoria={categoria.chave}
                  className="h-7 w-7"
                  style={{ color: ativa ? COR_TERRACOTA : COR_MARROM }}
                />
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    backgroundColor: ativa ? COR_DOURADO : COR_PAINEL,
                    color: ativa ? COR_MARROM : '#fff',
                  }}
                >
                  {categoria.rotulo}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* ---------- prato do momento (destaque automático do prato de hoje) ---------- */}
      {produtoDestaque && (
        <section className="px-6 pb-2 pt-6 text-center" style={{ backgroundColor: COR_CREME }}>
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-bold"
            style={{ backgroundColor: COR_DOURADO, color: COR_MARROM }}
          >
            ⭐ Prato do Momento
          </span>

          <div className="mx-auto mt-3 flex max-w-[280px] items-center justify-center">
            {produtoDestaque.imagem_url ? (
              <Image
                src={produtoDestaque.imagem_url}
                alt={produtoDestaque.nome}
                width={280}
                height={220}
                className="h-auto w-full object-contain"
                style={{ filter: `drop-shadow(${SOMBRA_FOTO})` }}
                unoptimized
              />
            ) : (
              <span className="text-6xl">{EMOJI_CATEGORIA[categoriaDoProduto(produtoDestaque)]}</span>
            )}
          </div>

          <h2 className={`${fonteExibicao.className} mt-2 text-xl font-extrabold`} style={{ color: COR_MARROM }}>
            {produtoDestaque.nome}
          </h2>
          <p className="mx-auto mt-1 max-w-[34ch] text-sm" style={{ color: COR_MARROM_SUAVE }}>
            {produtoDestaque.descricao}
          </p>
          <span className="mt-1 block text-lg font-extrabold" style={{ color: COR_TERRACOTA }}>
            {formatarMoeda(Number(produtoDestaque.preco_venda))}
          </span>

          <div className="mt-3 flex justify-center">
            <ProdutoDestaqueBotao produto={produtoDestaque} />
          </div>
        </section>
      )}

      {/* ---------- cardápio ---------- */}
      <section
        className="relative -mt-3 rounded-t-[26px] px-6 pb-10 pt-7"
        style={{ backgroundColor: '#fff' }}
      >
        {produtosFiltrados.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-xs italic" style={{ color: COR_MARROM_SUAVE }}>
              Cardápio sendo preparado na cozinha — volte em breve.
            </p>
          </div>
        ) : (
          produtosFiltrados.map((produto) => (
            <CartaoPratoCantina
              key={produto.id}
              produto={produto}
              emojiCategoria={EMOJI_CATEGORIA[categoriaAtiva]}
              expandido={produtoExpandidoId === produto.id}
              onToggleExpandir={() => alternarExpandido(produto.id)}
            />
          ))
        )}

        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          <DivisorOrnamental />
          <p className="text-[11px]" style={{ color: COR_MARROM_SUAVE }}>
            {restaurante.endereco?.trim() || 'Endereço do estabelecimento'}
          </p>
        </div>
      </section>

      <BarraCarrinhoFlutuante corBotaoAcao={COR_MARROM} corBadgeFundo={COR_DOURADO} corBadgeTexto={COR_MARROM} />
      </div>
    </div>
  );
}

/* botão de adicionar do bloco "Prato do Momento" — vive fora do card porque
   usa o contexto do carrinho isoladamente (mesmo produto pode não ter complementos) */
function ProdutoDestaqueBotao({ produto }: { produto: ItemCardapio }) {
  const { adicionarItem, itens, removerItem } = useCarrinho();
  const itemNoCarrinho = itens.find((item) => item.idUnico === produto.id);
  const qtd = itemNoCarrinho?.quantidade || 0;

  const categoria = categoriaDoProduto(produto);
  const disponivelHoje = categoria !== 'PRATOS' || produtoDisponivelHoje(produto);

  if (!disponivelHoje) {
    return <EtiquetaForaDoDia diaSemana={produto.dia_semana as number} variante="claro" />;
  }

  return (
    <SeletorQuantidade
      qtd={qtd}
      idUnicoCarrinho={produto.id}
      produto={produto}
      complementosSelecionados={[]}
      onAdicionar={adicionarItem}
      onRemover={removerItem}
      variante="claro"
    />
  );
}
