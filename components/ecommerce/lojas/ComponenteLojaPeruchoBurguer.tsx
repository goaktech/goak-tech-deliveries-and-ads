'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Baloo_2, Caveat } from 'next/font/google';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';

const fonteExibicao = Baloo_2({ subsets: ['latin'], weight: ['600', '700', '800'] });
const fonteManuscrita = Caveat({ subsets: ['latin'], weight: ['600', '700'] });

interface ComponenteLojaPeruchoBurguerProps {
  restaurante: { id: string; nome: string; endereco: string | null };
  produtos: ItemCardapio[];
}

/* =============================================================
   Paleta — mesmas cores do Royal Burguer (--ink, --ink-soft, --brown,
   --brown-soft, --gold, --cream, --cream-2 do style.css original).
   ============================================================= */
const COR_MARROM = '#3b2011'; // --ink
const COR_MARROM_SUAVE = '#6b4a33'; // --ink-soft
const COR_PAINEL = '#b15e33'; // --brown-soft (painel do card do prato + pill de categoria inativa)
const COR_PAINEL_TEXTO = '#ffffff'; // --white
const COR_DOURADO = '#f4a93c'; // --gold
const COR_CREME = '#f6efe0'; // --cream
const COR_CREME_ESCURO = '#efe3cc'; // --cream-2
const COR_TERRACOTA = '#9e4a1f'; // --brown
const COR_LINHA = 'rgba(107, 74, 51, 0.25)'; // --ink-soft com opacidade
const COR_FUNDO_PAGINA = '#e9dcc4'; // "mesa" atrás do cardápio em telas largas
const SOMBRA = '0 10px 26px rgba(59, 32, 17, 0.16)'; // --shadow
const SOMBRA_FOTO = '0 14px 16px rgba(59, 32, 17, 0.4)';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* =============================================================
   Categorização — igual ao Royal Burguer (Hambúrgueres / Entradas /
   Bebidas / Sobremesas — "Porções" virou "Entradas" a pedido).
   Usa o campo `categoria` cadastrado no admin quando bate com um
   sinônimo conhecido; senão cai numa heurística por nome, então
   itens ainda não categorizados continuam aparecendo no lugar certo.
   ============================================================= */
type CategoriaPerucho = 'HAMBURGUERES' | 'ENTRADAS' | 'BEBIDAS' | 'SOBREMESAS';

interface ProdutoParaCategorizar {
  nome: string;
  categoria?: string | null;
}

const SINONIMOS_CATEGORIA: Record<string, CategoriaPerucho> = {
  HAMBURGUER: 'HAMBURGUERES',
  HAMBÚRGUER: 'HAMBURGUERES',
  HAMBURGUERES: 'HAMBURGUERES',
  HAMBÚRGUERES: 'HAMBURGUERES',
  ENTRADA: 'ENTRADAS',
  ENTRADAS: 'ENTRADAS',
  PORCAO: 'ENTRADAS',
  PORÇÃO: 'ENTRADAS',
  PORCOES: 'ENTRADAS',
  PORÇÕES: 'ENTRADAS',
  ACOMPANHAMENTO: 'ENTRADAS',
  ACOMPANHAMENTOS: 'ENTRADAS',
  BEBIDA: 'BEBIDAS',
  BEBIDAS: 'BEBIDAS',
  SOBREMESA: 'SOBREMESAS',
  SOBREMESAS: 'SOBREMESAS',
  DOCE: 'SOBREMESAS',
  DOCES: 'SOBREMESAS',
};

function categoriaPorNome(nome: string): CategoriaPerucho {
  if (/sobremesa|doce|pudim|sorvete|mousse|brownie|torta|petit ?gateau|cheesecake|picaron/i.test(nome)) return 'SOBREMESAS';
  if (/suco|refrigerante|água|bebida|cerveja|drink|guaran[aá]|coca|milkshake|chicha|inca ?kola/i.test(nome)) return 'BEBIDAS';
  if (/batata|anel de cebola|onion|nugget|porç[ãa]o|molho|crispy|isca/i.test(nome)) return 'ENTRADAS';
  return 'HAMBURGUERES';
}

function categoriaDoProduto(produto: ProdutoParaCategorizar): CategoriaPerucho {
  const categoriaNormalizada = (produto.categoria ?? '').trim().toUpperCase();
  const categoriaConhecida = SINONIMOS_CATEGORIA[categoriaNormalizada];
  return categoriaConhecida ?? categoriaPorNome(produto.nome);
}

const ORDEM_CATEGORIAS: { chave: CategoriaPerucho; rotulo: string; emoji: string }[] = [
  { chave: 'HAMBURGUERES', rotulo: 'Hambúrgueres', emoji: '🍔' },
  { chave: 'ENTRADAS', rotulo: 'Entradas', emoji: '🍟' },
  { chave: 'BEBIDAS', rotulo: 'Bebidas', emoji: '🥤' },
  { chave: 'SOBREMESAS', rotulo: 'Sobremesas', emoji: '🍨' },
];

/* =============================================================
   Fotos reais — o Royal Burguer também só fotografa uma parte do
   cardápio (o resto usa o blob de cor + emoji); aqui o banco ainda
   não tem imagem_url cadastrado pra nenhum produto, então as fotos
   que já temos entram por um mapa local (nome → arquivo em /public),
   sem precisar mexer no banco. `produto.imagem_url` sempre tem
   prioridade quando existir (assim que alguém cadastrar uma foto
   pelo admin, ela passa a valer automaticamente).
   ============================================================= */
const FOTOS_LOCAIS: { correspondeNome: RegExp; src: string }[] = [
  { correspondeNome: /cl[aá]ssico/i, src: '/perucho-burguer-classico.webp' },
  { correspondeNome: /extra ?bacon|bacon/i, src: '/perucho-burguer-bacon.webp' },
];

function fotoLocalDoProduto(nome: string): string | undefined {
  return FOTOS_LOCAIS.find((f) => f.correspondeNome.test(nome))?.src;
}

const FOTO_DESTAQUE_FALLBACK = '/perucho-burguer-destaque.webp';

/* =============================================================
   Item em destaque no bloco "Lanche do Momento" (topo do cardápio).
   Mesma ideia do site original: 1 item marcado manualmente nos
   dados. Aqui não existe flag de destaque no banco, então o nome
   fica configurado neste código — troque quando quiser destacar
   outro item. Deixe "" pra desativar o bloco.
   ============================================================= */
const NOME_ITEM_DESTAQUE = 'Extra Bacon';

/* ---------- ícones de categoria (linha, marrom) — mesmos paths do Royal Burguer ---------- */
function IconeCategoria({
  categoria,
  className,
  style,
}: {
  categoria: CategoriaPerucho;
  className?: string;
  style?: React.CSSProperties;
}) {
  const CAMINHOS: Record<CategoriaPerucho, React.ReactNode> = {
    HAMBURGUERES: (
      <>
        <path d="M4 13c0-4.4 5.4-8 12-8s12 3.6 12 8" />
        <path d="M4 13h24" />
        <path d="M6 18h20" />
        <path d="M4 18c0 3.9 5 7 12 7s12-3.1 12-7" />
      </>
    ),
    ENTRADAS: (
      <>
        <path d="M8 12h16l-1.7 15H9.7z" />
        <path d="M12 12V5M16 12V3M20 12V6" />
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
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {CAMINHOS[categoria]}
    </svg>
  );
}

/* ---------- coroa + hambúrguer — mesmo marco (emblema) do rodapé do Royal Burguer ---------- */
function IconeCoroaHamburguer({ tom = 'escuro', className }: { tom?: 'claro' | 'escuro'; className?: string }) {
  const corLinhas = tom === 'claro' ? COR_CREME : COR_TERRACOTA;
  return (
    <svg viewBox="0 0 44 44" className={className} aria-hidden>
      <path d="M11 15 L15 7 L19 14 L22 5 L25 14 L29 7 L33 15 Z" fill={COR_DOURADO} />
      <rect x="9" y="16" width="26" height="5" rx="2.5" fill={COR_DOURADO} />
      <path d="M10 26 q12 -8 24 0" fill="none" stroke={corLinhas} strokeWidth="3.4" strokeLinecap="round" />
      <line x1="9" y1="32" x2="35" y2="32" stroke={corLinhas} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M10 38 q12 6 24 0" fill="none" stroke={corLinhas} strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- onda decorativa entre as seções do herói — recorte do Royal Burguer ---------- */
function OndaDivisoria({ corFundo, corOnda }: { corFundo: string; corOnda: string }) {
  return (
    <div style={{ backgroundColor: corFundo, lineHeight: 0 }} aria-hidden>
      <svg viewBox="0 0 500 44" preserveAspectRatio="none" className="block h-9 w-full">
        <path d="M0,44 C125,4 375,44 500,14 L500,44 L0,44 Z" fill={corOnda} />
      </svg>
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

interface CartaoPratoPeruchoProps {
  produto: ItemCardapio;
  emojiCategoria: string;
  fotoLocal?: string;
  expandido: boolean;
  onToggleExpandir: () => void;
}

function CartaoPratoPerucho({ produto, emojiCategoria, fotoLocal, expandido, onToggleExpandir }: CartaoPratoPeruchoProps) {
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
    <article className="relative ml-[18px] flex min-h-[150px] flex-col justify-center pl-[118px]">
      {/* foto em "blob" orgânico, sangrando pra esquerda e por cima do painel — mesma ideia do Royal Burguer */}
      <div
        className="absolute -left-[18px] top-1/2 z-[2] h-[142px] w-[142px] -translate-y-1/2 overflow-hidden rounded-[38%_38%_38%_12%]"
        style={{ boxShadow: SOMBRA_FOTO }}
      >
        {produto.imagem_url || fotoLocal ? (
          <Image
            src={produto.imagem_url || (fotoLocal as string)}
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
          superior esquerdo bem arredondado pra "abraçar" o blob */}
      <div
        className="relative z-[1] ml-[-64px] min-h-[108px] rounded-[34px_18px_18px_18px] py-3 pl-[78px] pr-4"
        style={{ backgroundColor: COR_PAINEL, boxShadow: SOMBRA }}
      >
        <p className="text-[13px] leading-snug" style={{ color: COR_PAINEL_TEXTO }}>
          {produto.descricao || 'Feito na hora, no ponto certo.'}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold" style={{ color: '#ffe6bf' }}>
            {formatarMoeda(Number(produto.preco_venda))}
          </span>
          {!temComplementos && (
            <SeletorQuantidade
              qtd={qtd}
              idUnicoCarrinho={idUnicoCarrinho}
              produto={produto}
              complementosSelecionados={complementosSelecionados}
              onAdicionar={adicionarItem}
              onRemover={removerItem}
              variante="escuro"
            />
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
            <SeletorQuantidade
              qtd={qtd}
              idUnicoCarrinho={idUnicoCarrinho}
              produto={produto}
              complementosSelecionados={complementosSelecionados}
              onAdicionar={adicionarItem}
              onRemover={removerItem}
              variante="claro"
            />
          </div>
        </div>
      )}
    </article>
  );
}

/* botão de adicionar do bloco "Lanche do Momento" — vive fora do card porque
   usa o contexto do carrinho isoladamente (o item pode não ter complementos) */
function ItemDestaqueBotao({ produto }: { produto: ItemCardapio }) {
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
      variante="claro"
    />
  );
}

export default function ComponenteLojaPeruchoBurguer({ restaurante, produtos }: ComponenteLojaPeruchoBurguerProps) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens } = useCarrinho();
  const [produtoExpandidoId, setProdutoExpandidoId] = useState<string | null>(null);
  const secoesRef = useRef<Partial<Record<CategoriaPerucho, HTMLElement>>>({});

  const alternarExpandido = (produtoId: string) => {
    setProdutoExpandidoId((atual) => (atual === produtoId ? null : produtoId));
  };

  // agrupa os produtos por categoria, na mesma ordem do Royal Burguer —
  // só entram categorias que realmente têm produto cadastrado
  const grupos = useMemo(
    () =>
      ORDEM_CATEGORIAS.map((categoria) => ({
        ...categoria,
        produtos: produtos.filter((produto) => categoriaDoProduto(produto) === categoria.chave),
      })).filter((grupo) => grupo.produtos.length > 0),
    [produtos]
  );

  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaPerucho>(grupos[0]?.chave ?? 'HAMBURGUERES');

  // realça na barra sticky a categoria que está no topo da tela — mesma
  // técnica (IntersectionObserver) do site original
  useEffect(() => {
    const elementos = grupos
      .map((grupo) => secoesRef.current[grupo.chave])
      .filter((el): el is HTMLElement => Boolean(el));
    if (elementos.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (!entrada.isIntersecting) return;
          const chave = entrada.target.getAttribute('data-categoria') as CategoriaPerucho | null;
          if (chave) setCategoriaAtiva(chave);
        });
      },
      { rootMargin: '-20% 0px -72% 0px' }
    );
    elementos.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [grupos]);

  const irParaCategoria = (chave: CategoriaPerucho) => {
    setCategoriaAtiva(chave);
    secoesRef.current[chave]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const itemDestaque = NOME_ITEM_DESTAQUE
    ? produtos.find((produto) => produto.nome.toLowerCase().includes(NOME_ITEM_DESTAQUE.toLowerCase()))
    : undefined;

  return (
    // moldura "celular" centralizada — mesma ideia do Royal Burguer (.phone),
    // um pouco mais larga que o --app original (480px) pra aproveitar melhor
    // telas de desktop, com fundo contrastante nas laterais.
    <div className="min-h-screen w-full" style={{ backgroundColor: COR_FUNDO_PAGINA }}>
      <div
        className="relative mx-auto min-h-screen w-full max-w-[560px] select-none pb-32 antialiased"
        style={{ backgroundColor: COR_CREME, boxShadow: '0 0 60px rgba(59, 32, 17, 0.18)' }}
      >
        {/* ---------- herói: réplica da composição do Royal Burguer — uma foto
            real sangrando por duas bandas (creme + marrom) com borda ondulada,
            coluna de texto à direita, e o emblema coroa+hambúrguer dourado
            fechando a terceira banda antes da navegação de categorias.
            Grid (não position:absolute + top/bottom) porque a foto precisa
            esticar pra cobrir a altura de 3 linhas cujo tamanho só é
            conhecido depois que o texto renderiza — é o próprio grid que
            resolve isso, esticando a coluna 1 pra acompanhar a coluna 2. ---------- */}
        <section className="relative grid" style={{ backgroundColor: COR_CREME, gridTemplateColumns: '54% 46%' }}>
          <Link
            href={`/${slug}/checkout`}
            className="absolute right-5 top-5 z-20 rounded-full p-2"
            style={{ backgroundColor: 'rgba(246, 239, 224, 0.9)', color: COR_MARROM }}
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

          {/* foto do lanche — ocupa a coluna 1 inteira, esticando (align-self:
              stretch é o padrão do grid) pra cobrir a altura das 3 linhas da
              coluna 2, com borda ondulada recortada à direita */}
          <div
            className="relative z-10 col-start-1 row-start-1 row-span-3 overflow-hidden"
            style={{
              clipPath: 'polygon(0% 0%, 100% 0%, 84% 20%, 100% 40%, 78% 58%, 100% 78%, 88% 100%, 0% 100%)',
            }}
          >
            <Image
              src="/perucho-burguer-classico.webp"
              alt=""
              fill
              sizes="(max-width: 560px) 54vw, 302px"
              className="object-cover"
              style={{ objectPosition: '30% 45%' }}
              priority
              aria-hidden
            />
          </div>

          {/* banda 1: crachá + letreiro (coluna 2, linha 1) */}
          <div className="relative z-0 col-start-2 row-start-1 flex flex-col items-end justify-center py-7 pr-6">
            <IconeCoroaHamburguer tom="escuro" className="h-10 w-10" />
            <h1 className={`${fonteExibicao.className} mt-2 text-2xl font-extrabold uppercase leading-[0.95]`} style={{ color: COR_MARROM }}>
              {(restaurante.nome || 'Perucho Burguer').split(' ')[0]}
              <br />
              <span style={{ color: COR_DOURADO }}>
                {(restaurante.nome || 'Perucho Burguer').split(' ').slice(1).join(' ') || 'Burguer'}
              </span>
            </h1>
            <p className="mt-2 text-[9px] font-bold uppercase leading-snug tracking-[0.14em]" style={{ color: COR_MARROM_SUAVE }}>
              Sabor de verdade
              <br />
              em cada mordida
            </p>
          </div>

          {/* onda decorativa entre a banda creme e a banda marrom — só na
              coluna de texto, a foto (coluna 1) segue contínua por trás */}
          <div className="relative z-0 col-start-2 row-start-2">
            <OndaDivisoria corFundo={COR_CREME} corOnda={COR_TERRACOTA} />
          </div>

          {/* banda 2: assinatura em script (coluna 2, linha 3) */}
          <div
            className="relative z-0 col-start-2 row-start-3 py-8 pr-6 text-right"
            style={{ background: `linear-gradient(160deg, ${COR_TERRACOTA} 0%, #7a3814 100%)` }}
          >
            <p className={`${fonteManuscrita.className} text-lg leading-tight`} style={{ color: COR_CREME }}>
              Mais que um
              <br />
              hambúrguer, uma
              <br />
              experiência.
            </p>
          </div>
        </section>

        <OndaDivisoria corFundo={COR_TERRACOTA} corOnda={COR_CREME} />

        {/* ---------- barra de categorias (sticky, âncoras pras seções abaixo) ---------- */}
        {grupos.length > 0 && (
          <nav
            className="sticky top-0 z-30 flex gap-2 px-4 py-3"
            style={{ backgroundColor: COR_CREME, boxShadow: '0 6px 14px rgba(59, 32, 17, 0.08)' }}
          >
            {grupos.map((grupo) => {
              const ativa = categoriaAtiva === grupo.chave;
              return (
                <button
                  key={grupo.chave}
                  type="button"
                  onClick={() => irParaCategoria(grupo.chave)}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <IconeCategoria
                    categoria={grupo.chave}
                    className="h-7 w-7"
                    style={{ color: ativa ? COR_TERRACOTA : COR_MARROM }}
                  />
                  <span
                    className="w-full rounded-full px-1 py-1 text-center text-[9px] font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: ativa ? COR_DOURADO : COR_PAINEL,
                      color: ativa ? COR_MARROM : '#fff',
                    }}
                  >
                    {grupo.rotulo}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* ---------- lanche do momento (destaque opcional) ---------- */}
        {itemDestaque && (
          <section className="px-6 pb-2 pt-6 text-center" style={{ backgroundColor: COR_CREME }}>
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-bold"
              style={{ backgroundColor: COR_DOURADO, color: COR_MARROM }}
            >
              ⭐ Lanche do Momento
            </span>

            <div className="mx-auto mt-3 flex max-w-[280px] items-center justify-center">
              <Image
                src={itemDestaque.imagem_url || fotoLocalDoProduto(itemDestaque.nome) || FOTO_DESTAQUE_FALLBACK}
                alt={itemDestaque.nome}
                width={280}
                height={220}
                className="h-auto w-full object-contain"
                style={{ filter: `drop-shadow(${SOMBRA_FOTO})` }}
                unoptimized
              />
            </div>

            <h2 className={`${fonteExibicao.className} mt-2 text-xl font-extrabold`} style={{ color: COR_MARROM }}>
              {itemDestaque.nome}
            </h2>
            <p className="mx-auto mt-1 max-w-[34ch] text-sm" style={{ color: COR_MARROM_SUAVE }}>
              {itemDestaque.descricao}
            </p>
            <span className="mt-1 block text-lg font-extrabold" style={{ color: COR_TERRACOTA }}>
              {formatarMoeda(Number(itemDestaque.preco_venda))}
            </span>

            <div className="mt-3 flex justify-center">
              <ItemDestaqueBotao produto={itemDestaque} />
            </div>
          </section>
        )}

        {/* ---------- cardápio: todas as categorias em sequência, cada uma com
            sua própria seção ancorada (igual ao Royal Burguer) ---------- */}
        <section className="relative -mt-3 rounded-t-[26px] px-6 pb-10 pt-7" style={{ backgroundColor: '#fff' }}>
          {grupos.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-xs italic" style={{ color: COR_MARROM_SUAVE }}>
                Cardápio na chapa — volte em breve.
              </p>
            </div>
          ) : (
            grupos.map((grupo) => (
              <section
                key={grupo.chave}
                data-categoria={grupo.chave}
                ref={(el) => {
                  if (el) secoesRef.current[grupo.chave] = el;
                }}
                className="mb-8 last:mb-0"
                style={{ scrollMarginTop: '84px' }}
              >
                <h2 className={`${fonteExibicao.className} mb-4 text-xl font-extrabold`} style={{ color: COR_MARROM }}>
                  {grupo.emoji} {grupo.rotulo}
                </h2>
                <div className="flex flex-col gap-6">
                  {grupo.produtos.map((produto) => (
                    <CartaoPratoPerucho
                      key={produto.id}
                      produto={produto}
                      emojiCategoria={grupo.emoji}
                      fotoLocal={fotoLocalDoProduto(produto.nome)}
                      expandido={produtoExpandidoId === produto.id}
                      onToggleExpandir={() => alternarExpandido(produto.id)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </section>

        {/* ---------- CTA final — leva pra sacola/checkout de verdade, no
            lugar do link de WhatsApp do site original ---------- */}
        <section className="px-6 py-10 text-center" style={{ backgroundColor: COR_TERRACOTA }}>
          <h2 className={`${fonteExibicao.className} text-2xl font-extrabold`} style={{ color: COR_CREME }}>
            Deu fome?
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: 'rgba(246, 239, 224, 0.85)' }}>
            Finalize seu pedido e receba certinho.
          </p>
          <Link
            href={`/${slug}/checkout`}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-wide"
            style={{ backgroundColor: COR_DOURADO, color: COR_MARROM, boxShadow: SOMBRA }}
          >
            <IconeSacola className="h-4 w-4" />
            Finalizar pedido
          </Link>
        </section>

        {/* ---------- rodapé ---------- */}
        <footer className="px-6 py-9 text-center" style={{ backgroundColor: COR_MARROM }}>
          <IconeCoroaHamburguer tom="claro" className="mx-auto h-11 w-11" />
          <p className={`${fonteManuscrita.className} mt-2 mb-3.5 text-xl`} style={{ color: COR_DOURADO }}>
            Sabor de verdade em cada mordida.
          </p>
          <p className="text-[13px]" style={{ color: 'rgba(246, 239, 224, 0.8)' }}>
            {restaurante.endereco?.trim() || 'Endereço do estabelecimento'}
          </p>
          <p className="mt-4 text-[11px]" style={{ color: 'rgba(246, 239, 224, 0.5)' }}>
            © {new Date().getFullYear()} {restaurante.nome || 'Perucho Burguer'} — cardápio digital.
          </p>
        </footer>

        <BarraCarrinhoFlutuante corBotaoAcao={COR_MARROM} corBadgeFundo={COR_DOURADO} corBadgeTexto={COR_MARROM} />
      </div>
    </div>
  );
}
