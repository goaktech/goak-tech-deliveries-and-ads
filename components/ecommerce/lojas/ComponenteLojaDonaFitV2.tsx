'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ehSobEncomenda,
  etiquetasDoProduto,
  extrairMacros,
  formatarMoeda,
  type GrupoCategoria,
} from '@/components/ecommerce/lojas/dona-fit/dados';
import estilos from './ComponenteLojaDonaFitV2.module.css';

interface ComponenteLojaDonaFitV2Props {
  restaurante: { id: string; nome: string; endereco: string | null; logoUrl?: string | null };
  produtos: ItemCardapio[];
}

type ChaveFiltro = 'todos' | 'veg' | 'lowcarb';

const FILTROS: ReadonlyArray<{ chave: ChaveFiltro; rotulo: string }> = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'veg', rotulo: 'Vegano e vegetariano' },
  { chave: 'lowcarb', rotulo: 'Low carb' },
];

function passaNoFiltro(produto: ItemCardapio, filtro: ChaveFiltro) {
  if (filtro === 'todos') return true;
  const etiquetas = etiquetasDoProduto(produto.nome);
  if (filtro === 'veg') return etiquetas.includes('Vegano') || etiquetas.includes('Vegetariano');
  return etiquetas.includes('Low carb');
}

function ListaMacros({ produto }: { produto: ItemCardapio }) {
  const { macros } = extrairMacros(produto.descricao);
  const etiquetas = etiquetasDoProduto(produto.nome);
  if (!macros && etiquetas.length === 0) return null;

  return (
    <span className={estilos.macros}>
      {etiquetas.map((etiqueta) => (
        <span key={etiqueta} className={estilos.etiqueta}>{etiqueta}</span>
      ))}
      {macros?.proteinas ? <span className={estilos.macro}>{macros.proteinas}g prot</span> : null}
      {macros?.kcal ? <span className={estilos.macro}>{macros.kcal} kcal</span> : null}
    </span>
  );
}

interface FolhaProdutoProps {
  produto: ItemCardapio;
  onFechar: () => void;
}

function FolhaProduto({ produto, onFechar }: FolhaProdutoProps) {
  const { adicionarItem, removerItem, itens } = useCarrinho();
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const botaoFecharRef = useRef<HTMLButtonElement>(null);
  const { macros, texto } = extrairMacros(produto.descricao);
  const adicionais = (produto.complementos_produto || []).filter((c) => c.disponivel);

  useEffect(() => {
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    botaoFecharRef.current?.focus();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [onFechar]);

  const complementosEscolhidos = adicionais
    .filter((c) => selecionados.includes(c.id))
    .map<Complemento>((c) => ({
      id: c.id,
      item_cardapio_id: c.item_cardapio_id || produto.id,
      nome: c.nome,
      preco_adicional: Number(c.preco_adicional),
      disponivel: c.disponivel,
      grupo: c.grupo ?? null,
    }));

  const idsOrdenados = complementosEscolhidos.map((c) => c.id).sort().join('-');
  const idUnico = idsOrdenados ? `${produto.id}-${idsOrdenados}` : produto.id;
  const qtd = itens.find((item) => item.idUnico === idUnico)?.quantidade || 0;
  const total = Number(produto.preco_venda) + complementosEscolhidos.reduce((acc, c) => acc + Number(c.preco_adicional), 0);

  const alternar = (id: string) => {
    setSelecionados((atuais) => (atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id]));
  };

  return (
    <div
      className={estilos.fundoFolha}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onFechar();
      }}
    >
      <div className={estilos.folha} role="dialog" aria-modal="true" aria-label={produto.nome}>
        <div className={estilos.folhaFoto}>
          <FotoItem src={produto.imagem_url} alt={produto.nome} tamanho={640} />
          <button ref={botaoFecharRef} type="button" className={estilos.botaoFechar} onClick={onFechar} aria-label="Fechar detalhes">
            ×
          </button>
        </div>

        <div className={estilos.folhaCorpo}>
          <h2 className={estilos.folhaTitulo}>{produto.nome}</h2>
          <ListaMacros produto={produto} />
          {texto ? <p className={estilos.folhaDescricao}>{texto}</p> : null}

          {macros ? (
            <ul className={estilos.grade}>
              <li className={estilos.grandeza}><strong>{macros.proteinas ?? '-'}</strong><span>proteína (g)</span></li>
              <li className={estilos.grandeza}><strong>{macros.carboidratos ?? '-'}</strong><span>carbo (g)</span></li>
              <li className={estilos.grandeza}><strong>{macros.kcal ?? '-'}</strong><span>kcal</span></li>
            </ul>
          ) : null}

          {adicionais.length > 0 ? (
            <>
              <h3 className={estilos.adicionaisTitulo}>Adicionais</h3>
              {adicionais.map((adicional) => {
                const ativo = selecionados.includes(adicional.id);
                return (
                  <button
                    key={adicional.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => alternar(adicional.id)}
                    className={`${estilos.adicional} ${ativo ? estilos.adicionalAtivo : ''}`}
                  >
                    <span>{adicional.nome}</span>
                    <span>+{formatarMoeda(Number(adicional.preco_adicional))}</span>
                  </button>
                );
              })}
            </>
          ) : null}
        </div>

        <div className={estilos.rodapeFolha}>
          {qtd > 0 ? (
            <div className={estilos.passo}>
              <button type="button" className={estilos.botaoMenos} onClick={() => removerItem(idUnico)} aria-label="Remover uma unidade">
                −
              </button>
              <span className={estilos.quantidade} aria-live="polite">{qtd}</span>
            </div>
          ) : null}
          <button type="button" className={estilos.botaoPrincipal} onClick={() => adicionarItem(produto, complementosEscolhidos)}>
            {qtd > 0 ? `Mais um · ${formatarMoeda(total)}` : `Adicionar · ${formatarMoeda(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SecaoCategoriaProps {
  grupo: GrupoCategoria;
  onAbrir: (produto: ItemCardapio) => void;
}

function SecaoCategoria({ grupo, onAbrir }: SecaoCategoriaProps) {
  const { adicionarItem, removerItem, itens } = useCarrinho();

  return (
    <section id={grupo.id} data-categoria={grupo.id} className={estilos.secao} aria-labelledby={`${grupo.id}-titulo`}>
      <h2 id={`${grupo.id}-titulo`} className={estilos.secaoTitulo}>{grupo.nome}</h2>
      {ehSobEncomenda(grupo.nome) ? <p className={estilos.aviso}>Feitos sob encomenda, entrega agendada.</p> : null}

      <ul className={estilos.lista}>
        {grupo.produtos.map((produto) => {
          const { texto } = extrairMacros(produto.descricao);
          const temAdicionais = (produto.complementos_produto || []).some((c) => c.disponivel);
          const qtd = temAdicionais ? 0 : itens.find((item) => item.idUnico === produto.id)?.quantidade || 0;

          return (
            <li key={produto.id} className={estilos.item}>
              <button type="button" className={estilos.cartao} onClick={() => onAbrir(produto)} aria-label={`Ver detalhes de ${produto.nome}`}>
                <span className={estilos.foto}>
                  <FotoItem src={produto.imagem_url} alt="" tamanho={88} />
                </span>
                <span className={estilos.corpo}>
                  <span className={estilos.nomeItem}>{produto.nome}</span>
                  <ListaMacros produto={produto} />
                  {!texto ? null : <span className="sr-only">{texto}</span>}
                  <span className={estilos.preco}>{formatarMoeda(Number(produto.preco_venda))}</span>
                </span>
              </button>

              <div className={estilos.acaoItem}>
                {qtd > 0 ? (
                  <>
                    <button type="button" className={estilos.botaoMenos} onClick={() => removerItem(produto.id)} aria-label={`Remover uma unidade de ${produto.nome}`}>
                      −
                    </button>
                    <span className={estilos.quantidade} aria-live="polite">{qtd}</span>
                  </>
                ) : null}
                <button
                  type="button"
                  className={estilos.botaoMais}
                  onClick={() => (temAdicionais ? onAbrir(produto) : adicionarItem(produto, []))}
                  aria-label={`Adicionar ${produto.nome} à sacola`}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function ComponenteLojaDonaFitV2({ restaurante, produtos }: ComponenteLojaDonaFitV2Props) {
  const params = useParams();
  const slug = resolverSlugLoja((params?.slug as string) || '');
  const { totalItens } = useCarrinho();
  const [filtro, setFiltro] = useState<ChaveFiltro>('todos');
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [produtoAberto, setProdutoAberto] = useState<ItemCardapio | null>(null);

  const grupos = useMemo(
    () =>
      agruparPorCategoria(produtos)
        .map((grupo) => ({ ...grupo, produtos: grupo.produtos.filter((produto) => passaNoFiltro(produto, filtro)) }))
        .filter((grupo) => grupo.produtos.length > 0),
    [produtos, filtro]
  );

  const whatsapp = obterConfigLojaEspecial(slug).whatsappAtendimento;
  const nomeMarca = restaurante.nome.split(' - ')[0].trim() || NOME_MARCA;

  useEffect(() => {
    if (grupos.length === 0) return;
    const secoes = grupos
      .map((grupo) => document.getElementById(grupo.id))
      .filter((elemento): elemento is HTMLElement => Boolean(elemento));
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.find((entrada) => entrada.isIntersecting);
        if (visivel) setCategoriaAtiva(visivel.target.id);
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    secoes.forEach((secao) => observador.observe(secao));
    return () => observador.disconnect();
  }, [grupos]);

  const irParaCategoria = (id: string) => {
    setCategoriaAtiva(id);
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' });
  };

  const fecharFolha = useCallback(() => setProdutoAberto(null), [setProdutoAberto]);

  return (
    <div className={estilos.pagina}>
      <header className={estilos.topo}>
        <div className={estilos.topoConteudo}>
          <div className={estilos.barraTopo}>
            <div className={estilos.marca}>
              <span className={estilos.logo}>
                <FotoItem src={restaurante.logoUrl} alt={`Logo ${nomeMarca}`} tamanho={40} placeholder="🌿" />
              </span>
              <p className={estilos.nomeMarca}>
                {nomeMarca}
                <span className={estilos.sloganMarca}>{SLOGAN_MARCA}</span>
              </p>
            </div>

            <Link href={`/${slug}/checkout`} className={estilos.botaoSacola} aria-label={`Ver sacola${totalItens > 0 ? `, ${totalItens} itens` : ''}`}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
              </svg>
              {totalItens > 0 ? <span className={estilos.contador}>{totalItens}</span> : null}
            </Link>
          </div>

          <h1 className={estilos.titulo}>
            Comida saudável que cabe na <em>sua rotina</em>
          </h1>
          <p className={estilos.subtitulo}>
            Pratos equilibrados, com proteína, carboidrato e calorias à vista, para você escolher com tranquilidade.
          </p>

          <ul className={estilos.selos}>
            <li className={estilos.selo}>Sob encomenda</li>
            <li className={estilos.selo}>Entrega seg a sex, 8h às 19h</li>
            <li className={estilos.selo}>Opções veg e low carb</li>
          </ul>
        </div>
      </header>

      <div className={estilos.areaFiltros}>
        <div className={estilos.faixa} role="group" aria-label="Filtrar por estilo">
          {FILTROS.map((opcao) => (
            <button
              key={opcao.chave}
              type="button"
              className={`${estilos.filtro} ${filtro === opcao.chave ? estilos.filtroAtivo : ''}`}
              aria-pressed={filtro === opcao.chave}
              onClick={() => setFiltro(opcao.chave)}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className={estilos.navegacao}>
        <div className={estilos.navegacaoInterna}>
          <nav className={estilos.faixa} aria-label="Categorias do cardápio">
            {grupos.map((grupo) => {
              const ativa = (categoriaAtiva ?? grupos[0]?.id) === grupo.id;
              return (
                <button
                  key={grupo.id}
                  type="button"
                  className={`${estilos.chip} ${ativa ? estilos.chipAtivo : ''}`}
                  aria-current={ativa ? 'true' : undefined}
                  onClick={() => irParaCategoria(grupo.id)}
                >
                  {grupo.nome}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <main className={estilos.conteudo}>
        {grupos.length === 0 ? (
          <p className={estilos.vazio}>
            {produtos.length === 0 ? 'O cardápio está sendo atualizado. Volte em instantes.' : 'Nenhum prato encontrado neste filtro.'}
          </p>
        ) : (
          grupos.map((grupo) => <SecaoCategoria key={grupo.id} grupo={grupo} onAbrir={setProdutoAberto} />)
        )}
      </main>

      <footer className={estilos.rodape}>
        <p>{restaurante.endereco?.trim() || 'Endereço do estabelecimento'}</p>
        {whatsapp ? (
          <p>
            <a href={`https://wa.me/55${whatsapp}`} target="_blank" rel="noopener noreferrer">
              Falar com a loja no WhatsApp
            </a>
          </p>
        ) : null}
      </footer>

      {produtoAberto ? <FolhaProduto produto={produtoAberto} onFechar={fecharFolha} /> : null}

      <BarraCarrinhoFlutuante corBotaoAcao="#1F4D3A" corBadgeFundo="#E4EEDC" corBadgeTexto="#1F4D3A" />
    </div>
  );
}
