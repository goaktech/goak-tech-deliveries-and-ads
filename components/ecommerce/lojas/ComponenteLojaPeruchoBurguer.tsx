'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Fraunces, Work_Sans } from 'next/font/google';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';
import {
  obterDiaSemanaAtualBrasil,
  obterStatusFuncionamento,
  type HorarioFuncionamentoDia,
} from '@/utils/horario-funcionamento';

const fonteExibicao = Fraunces({ subsets: ['latin'], weight: ['600', '700', '800'], style: ['normal', 'italic'] });
const fonteCorpo = Work_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

interface ComponenteLojaPeruchoBurguerProps {
  restaurante: {
    id: string;
    nome: string;
    endereco: string | null;
    /** Usado pra tarja "Aberto agora · fecha às Xh" no herói. */
    horariosFuncionamento?: HorarioFuncionamentoDia[] | null;
    /** Foto de capa cadastrada pelo gestor em Configurações. Tem prioridade sobre a foto de produto no herói. */
    fotoCapaUrl?: string | null;
  };
  produtos: ItemCardapio[];
}

/* =============================================================
   Paleta — essência marrom/dourado/creme do Perucho Burguer, com
   o painel escurecido pra passar no contraste WCAG AA (o `#b15e33`
   original dava ~2.9:1 com texto branco; o `#7a3814` dá ~8.8:1).
   Os cards de item agora usam fundo branco (ver seção "cards de
   item" abaixo), então COR_PAINEL só é usada nas pills inativas
   da barra de categorias.
   ============================================================= */
const COR_MARROM = '#3B2011';
const COR_MARROM_SUAVE = '#6B4A33';
const COR_PAINEL = '#7A3814';
const COR_DOURADO = '#F4A93C';
const COR_CREME = '#F6EFE0';
const COR_CREME_ESCURO = '#EFE3CC';
const COR_TERRACOTA = '#9E4A1F';
const COR_LINHA = 'rgba(107, 74, 51, 0.25)';
const COR_FUNDO_PAGINA = '#E9DCC4';
const COR_INDISPONIVEL = '#F1EAD9';
const SOMBRA = '0 10px 26px rgba(59, 32, 17, 0.16)';
const SOMBRA_FOTO = '0 10px 14px rgba(59, 32, 17, 0.18)';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* =============================================================
   Categorização — usa o campo `categoria` cadastrado no admin
   quando bate com um sinônimo conhecido; senão cai numa heurística
   por nome, então itens ainda não categorizados continuam
   aparecendo no lugar certo.
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

const ORDEM_CATEGORIAS: { chave: CategoriaPerucho; rotulo: string }[] = [
  { chave: 'HAMBURGUERES', rotulo: 'Hambúrgueres' },
  { chave: 'ENTRADAS', rotulo: 'Entradas' },
  { chave: 'BEBIDAS', rotulo: 'Bebidas' },
  { chave: 'SOBREMESAS', rotulo: 'Sobremesas' },
];

/* =============================================================
   Disponibilidade — sem `dia_semana` o item vale todo dia
   (comportamento padrão); com `dia_semana`, só aparece liberado
   no dia certo. `disponivel === false` sempre bloqueia,
   independente do dia.
   ============================================================= */
function produtoDisponivelHoje(produto: Pick<ItemCardapio, 'disponivel' | 'dia_semana'>, agora = new Date()): boolean {
  if (produto.disponivel === false) return false;
  if (produto.dia_semana === null || produto.dia_semana === undefined) return true;
  return produto.dia_semana === obterDiaSemanaAtualBrasil(agora);
}

/* =============================================================
   Item em destaque no bloco "Lanche do Momento" (topo do
   cardápio). Sem flag de destaque no banco, o nome fica
   configurado aqui — troque quando quiser destacar outro item.
   Deixe "" pra desativar o bloco.
   ============================================================= */
const NOME_ITEM_DESTAQUE = 'Extra Bacon';

/* ---------- ícones de categoria (linha, marrom) ---------- */
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

/* ---------- selo redondo "PB" (topo/rodapé) ---------- */
function SeloPB({ tom = 'escuro', className }: { tom?: 'claro' | 'escuro'; className?: string }) {
  const cor = tom === 'claro' ? COR_DOURADO : COR_MARROM;
  return (
    <div
      className={`flex items-center justify-center rounded-full border-2 ${className ?? ''}`}
      style={{ borderColor: cor, color: cor }}
    >
      <span className={fonteExibicao.className} style={{ fontWeight: 700 }}>
        PB
      </span>
    </div>
  );
}

/* =============================================================
   Foto do prato — moldura quadrada de cantos arredondados, com
   leve rotação. Padrão único pra TODAS as categorias (Hambúrgueres,
   Entradas, Bebidas, Sobremesas): fundo branco, foto real do banco
   (`produto.imagem_url`, sem depender de arquivo em /public), com
   um ícone da categoria como retrato de espera quando o produto
   ainda não tem foto cadastrada.
   ============================================================= */
function FotoProduto({
  produto,
  categoria,
  tamanho,
  rotacaoGraus,
  apagada,
}: {
  produto: Pick<ItemCardapio, 'nome' | 'imagem_url'>;
  categoria: CategoriaPerucho;
  tamanho: number;
  rotacaoGraus: number;
  apagada?: boolean;
}) {
  if (produto.imagem_url) {
    return (
      <div
        className="relative overflow-hidden rounded-[20px]"
        style={{ width: tamanho, height: tamanho, boxShadow: SOMBRA_FOTO, opacity: apagada ? 0.6 : 1 }}
      >
        <Image
          src={produto.imagem_url}
          alt={produto.nome}
          width={tamanho}
          height={tamanho}
          className="h-full w-full object-cover"
          style={{ transform: `rotate(${rotacaoGraus}deg) scale(1.15)` }}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-[20px]"
      style={{
        width: tamanho,
        height: tamanho,
        background: 'radial-gradient(circle at 38% 30%, #ffe0b0, #e2a860 65%, #c67d43)',
        boxShadow: SOMBRA_FOTO,
        opacity: apagada ? 0.6 : 1,
      }}
    >
      <IconeCategoria categoria={categoria} className="h-10 w-10" style={{ color: COR_MARROM }} />
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
  /** 'claro' = para usar sobre fundo creme/branco · 'escuro' = para usar sobre fundo marrom */
  variante?: 'claro' | 'escuro';
}

/* Toques de 44px (mínimo recomendado pra toque em telas pequenas). */
function SeletorQuantidade({
  qtd,
  idUnicoCarrinho,
  produto,
  complementosSelecionados,
  onAdicionar,
  onRemover,
  variante = 'claro',
}: SeletorQuantidadeProps) {
  const corBorda = variante === 'escuro' ? 'rgba(255, 255, 255, 0.55)' : 'rgba(59, 32, 17, 0.25)';
  const corTexto = variante === 'escuro' ? '#fff' : COR_MARROM;
  const corBotaoPreenchido = variante === 'escuro' ? COR_DOURADO : COR_DOURADO;
  const corTextoPreenchido = COR_MARROM;

  if (qtd > 0) {
    return (
      <div className="flex items-center gap-2 rounded-full p-1" style={{ border: `1.5px solid ${corBorda}` }}>
        <button
          type="button"
          onClick={() => onRemover(idUnicoCarrinho)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold"
          style={{ color: corTexto }}
          aria-label="Remover um"
        >
          −
        </button>
        <span className="min-w-[1.5ch] text-center text-sm font-bold" style={{ color: corTexto }}>
          {qtd}
        </span>
        <button
          type="button"
          onClick={() => onAdicionar(produto, complementosSelecionados)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold"
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
      className="flex h-11 items-center justify-center rounded-full px-5 text-xs font-bold uppercase tracking-wide"
      style={{ backgroundColor: corBotaoPreenchido, color: corTextoPreenchido }}
    >
      Adicionar
    </button>
  );
}

interface CartaoPratoPeruchoProps {
  produto: ItemCardapio;
  expandido: boolean;
  onToggleExpandir: () => void;
  rotacaoFoto: number;
}

/* =============================================================
   Card de item — padrão único usado em TODAS as categorias:
   fundo branco, sem borda, foto real numa moldura quadrada de
   cantos arredondados posicionada por dentro do card e
   centralizada verticalmente (metade acima, metade abaixo do
   meio do card).
   ============================================================= */
function CartaoPratoPerucho({ produto, expandido, onToggleExpandir, rotacaoFoto }: CartaoPratoPeruchoProps) {
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
  const disponivelHoje = produtoDisponivelHoje(produto);
  const categoria = categoriaDoProduto(produto);

  const togglePill = (id: string) => {
    setComplementosSelecionadosIds((atuais) =>
      atuais.includes(id) ? atuais.filter((itemId) => itemId !== id) : [...atuais, id]
    );
  };

  return (
    <article className="relative" style={{ marginBottom: 22 }}>
      <div className="absolute z-[3]" style={{ left: 8, top: '50%', transform: 'translateY(-50%)' }}>
        <FotoProduto produto={produto} categoria={categoria} tamanho={104} rotacaoGraus={rotacaoFoto} apagada={!disponivelHoje} />
      </div>

      <div
        className="min-h-[112px] rounded-[22px] py-3.5 pr-4"
        style={{ backgroundColor: disponivelHoje ? '#FFFFFF' : COR_INDISPONIVEL, paddingLeft: 118 }}
      >
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3
            className={`${fonteExibicao.className} text-base font-extrabold leading-tight`}
            style={{ color: COR_MARROM }}
          >
            {produto.nome}
          </h3>
          {NOME_ITEM_DESTAQUE && produto.nome.toLowerCase().includes(NOME_ITEM_DESTAQUE.toLowerCase()) && disponivelHoje && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: COR_DOURADO, color: COR_MARROM }}>
              Mais pedido
            </span>
          )}
        </div>

        {disponivelHoje ? (
          <>
            <p className="mb-2 text-[12.5px] leading-snug" style={{ color: COR_MARROM_SUAVE }}>
              {produto.descricao || 'Feito na hora, no ponto certo.'}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-bold" style={{ color: COR_TERRACOTA }}>
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
                  variante="claro"
                />
              )}
            </div>
          </>
        ) : (
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#8a6a4a' }}>
            Indisponível hoje
          </p>
        )}
      </div>

      {disponivelHoje && temComplementos && (
        <button
          type="button"
          onClick={onToggleExpandir}
          className="mt-2 flex min-h-[36px] items-center gap-1 text-xs font-bold uppercase tracking-wide"
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

      {disponivelHoje && expandido && temComplementos && (
        <div className="animate-in fade-in mt-2 space-y-3 rounded-2xl border px-3 py-3 duration-200" style={{ borderColor: COR_LINHA, backgroundColor: COR_CREME_ESCURO }}>
          <span className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: COR_TERRACOTA }}>
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
                  className="min-h-[36px] rounded-full px-3 py-1.5 text-[12px] font-bold transition-all"
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

  // agrupa os produtos por categoria — só entram categorias que
  // realmente têm produto cadastrado
  const grupos = useMemo(
    () =>
      ORDEM_CATEGORIAS.map((categoria) => ({
        ...categoria,
        produtos: produtos.filter((produto) => categoriaDoProduto(produto) === categoria.chave),
      })).filter((grupo) => grupo.produtos.length > 0),
    [produtos]
  );

  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaPerucho>(grupos[0]?.chave ?? 'HAMBURGUERES');

  // realça na barra sticky a categoria que está no topo da tela
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
    ? produtos.find(
        (produto) => produto.nome.toLowerCase().includes(NOME_ITEM_DESTAQUE.toLowerCase()) && produtoDisponivelHoje(produto)
      )
    : undefined;

  const status = obterStatusFuncionamento(restaurante.horariosFuncionamento, new Date());

  return (
    <div className={`${fonteCorpo.className} min-h-screen w-full`} style={{ backgroundColor: COR_FUNDO_PAGINA }}>
      <div
        className="relative mx-auto min-h-screen w-full max-w-[560px] pb-32 antialiased"
        style={{ backgroundColor: COR_CREME, boxShadow: '0 0 60px rgba(59, 32, 17, 0.18)' }}
      >
        {/* ---------- topo: selo "PB" + nome da loja + sacola ---------- */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <SeloPB className="h-9 w-9 text-sm" />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: COR_MARROM }}>
              {restaurante.nome || 'Perucho Burguer'}
            </span>
          </div>
          <Link
            href={`/${slug}/checkout`}
            className="relative flex h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: '#fff', color: COR_MARROM, boxShadow: '0 4px 10px rgba(59,32,17,0.12)' }}
            aria-label="Ver sacola"
          >
            <IconeSacola className="h-5 w-5" />
            {totalItens > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
                style={{ backgroundColor: COR_DOURADO, color: COR_MARROM }}
              >
                {totalItens}
              </span>
            )}
          </Link>
        </div>

        {/* ---------- herói: foto cheia + selo de status real + título serifado ---------- */}
        <div className="relative">
          <Image
            src="/perucho-burguer-classico.webp"
            alt="Hambúrguer Clássico Perucho Burguer, servido em pão brioche com queijo, alface e tomate"
            width={560}
            height={300}
            className="block h-[280px] w-full object-cover"
            priority
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(59,32,17,0) 38%, rgba(59,32,17,0.82) 100%)' }}
          />
          <div className="absolute bottom-4 left-5 right-5">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: status.aberto ? COR_DOURADO : '#D9CBB0', color: COR_MARROM }}
            >
              {status.texto}
            </span>
            <h1 className={`${fonteExibicao.className} mt-2.5 text-[32px] font-bold leading-[0.98]`} style={{ color: COR_CREME }}>
              {(restaurante.nome || 'Perucho Burguer').split(' ')[0]}
              <br />
              <span style={{ color: COR_DOURADO }}>
                {(restaurante.nome || 'Perucho Burguer').split(' ').slice(1).join(' ') || 'Burguer'}
              </span>
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: COR_CREME_ESCURO }}>
              Sabor de verdade, do jeito certo.
            </p>
          </div>
        </div>

        {/* ---------- barra de categorias (sticky, com rolagem horizontal) ---------- */}
        {grupos.length > 0 && (
          <nav
            aria-label="Categorias do cardápio"
            className="sticky top-0 z-30 flex gap-2 overflow-x-auto px-3.5 py-3"
            style={{ backgroundColor: COR_CREME, boxShadow: '0 6px 14px rgba(59, 32, 17, 0.08)' }}
          >
            {grupos.map((grupo) => {
              const ativa = categoriaAtiva === grupo.chave;
              return (
                <a
                  key={grupo.chave}
                  href={`#${grupo.chave.toLowerCase()}`}
                  onClick={(e) => {
                    e.preventDefault();
                    irParaCategoria(grupo.chave);
                  }}
                  aria-current={ativa ? 'true' : undefined}
                  className="flex min-h-[44px] w-20 flex-none flex-col items-center gap-1.5 px-0.5 py-1"
                >
                  <IconeCategoria
                    categoria={grupo.chave}
                    className="h-6 w-6"
                    style={{ color: ativa ? COR_TERRACOTA : COR_MARROM }}
                  />
                  <span
                    className="w-full rounded-full px-1 py-1.5 text-center text-xs font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: ativa ? COR_DOURADO : COR_PAINEL,
                      color: ativa ? COR_MARROM : '#fff',
                    }}
                  >
                    {grupo.rotulo}
                  </span>
                </a>
              );
            })}
          </nav>
        )}

        {/* ---------- lanche do momento (destaque opcional) — foto real do
            banco, moldura quadrada de cantos arredondados ---------- */}
        {itemDestaque && (
          <section className="px-6 pb-2 pt-6 text-center" style={{ backgroundColor: COR_CREME }}>
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-bold"
              style={{ backgroundColor: COR_DOURADO, color: COR_MARROM }}
            >
              ⭐ Lanche do Momento
            </span>

            <div className="mx-auto mt-4 flex justify-center">
              {itemDestaque.imagem_url ? (
                <div className="overflow-hidden rounded-[28px]" style={{ width: 220, height: 220, boxShadow: SOMBRA }}>
                  <Image
                    src={itemDestaque.imagem_url}
                    alt={itemDestaque.nome}
                    width={220}
                    height={220}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  className="flex items-center justify-center rounded-[28px]"
                  style={{ width: 220, height: 220, background: 'radial-gradient(circle at 38% 30%, #ffe0b0, #e2a860 65%, #c67d43)', boxShadow: SOMBRA }}
                >
                  <IconeCategoria categoria={categoriaDoProduto(itemDestaque)} className="h-16 w-16" style={{ color: COR_MARROM }} />
                </div>
              )}
            </div>

            <h2 className={`${fonteExibicao.className} mt-3 text-xl font-extrabold`} style={{ color: COR_MARROM }}>
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

        {/* ---------- cardápio: todas as categorias em sequência, cada uma
            com id próprio (compartilhável / acessível) ---------- */}
        <section className="relative mt-3.5 rounded-t-[26px] px-6 pb-10 pt-7" style={{ backgroundColor: '#fff' }}>
          {grupos.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm italic" style={{ color: COR_MARROM_SUAVE }}>
                Cardápio na chapa — volte em breve.
              </p>
            </div>
          ) : (
            grupos.map((grupo) => (
              <section
                key={grupo.chave}
                id={grupo.chave.toLowerCase()}
                data-categoria={grupo.chave}
                ref={(el) => {
                  if (el) secoesRef.current[grupo.chave] = el;
                }}
                className="mb-8 last:mb-0"
                style={{ scrollMarginTop: '76px' }}
              >
                <h2 className={`${fonteExibicao.className} mb-5 text-xl font-extrabold`} style={{ color: COR_MARROM }}>
                  {grupo.rotulo}
                </h2>
                <div className="flex flex-col">
                  {grupo.produtos.map((produto, indice) => (
                    <CartaoPratoPerucho
                      key={produto.id}
                      produto={produto}
                      expandido={produtoExpandidoId === produto.id}
                      onToggleExpandir={() => alternarExpandido(produto.id)}
                      rotacaoFoto={indice % 2 === 0 ? -4 : 3}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </section>

        {/* ---------- CTA final — leva pra sacola/checkout de verdade ---------- */}
        <section className="px-6 py-10 text-center" style={{ backgroundColor: COR_TERRACOTA }}>
          <h2 className={`${fonteExibicao.className} text-2xl font-extrabold`} style={{ color: COR_CREME }}>
            Deu fome?
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: 'rgba(246, 239, 224, 0.85)' }}>
            Finalize seu pedido e receba certinho.
          </p>
          <Link
            href={`/${slug}/checkout`}
            className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-sm font-bold uppercase tracking-wide"
            style={{ backgroundColor: COR_DOURADO, color: COR_MARROM, boxShadow: SOMBRA }}
          >
            <IconeSacola className="h-4 w-4" />
            Finalizar pedido
          </Link>
        </section>

        {/* ---------- rodapé ---------- */}
        <footer className="px-6 py-9 text-center" style={{ backgroundColor: COR_MARROM }}>
          <SeloPB tom="claro" className="mx-auto h-11 w-11 text-base" />
          <p className={`${fonteExibicao.className} mt-3 mb-3.5 text-lg italic`} style={{ color: COR_DOURADO }}>
            Sabor de verdade em cada mordida.
          </p>
          <p className="text-[13px]" style={{ color: 'rgba(246, 239, 224, 0.85)' }}>
            {restaurante.endereco?.trim() || 'Endereço do estabelecimento'}
          </p>
          <p className="mt-3 text-[11px]" style={{ color: 'rgba(246, 239, 224, 0.5)' }}>
            © {new Date().getFullYear()} {restaurante.nome || 'Perucho Burguer'} — cardápio digital.
          </p>
        </footer>

        <BarraCarrinhoFlutuante corBotaoAcao={COR_MARROM} corBadgeFundo={COR_DOURADO} corBadgeTexto={COR_MARROM} />
      </div>
    </div>
  );
}
