'use client';

/**
 * Perucho Burguer — versão de design "Parrilla" (slug perucho-burguer-v3).
 * Fundo claro, fotos grandes com o nome por cima, combos e hambúrgueres em carrosséis e botão "Adicionar" dourado.
 * Os dados e o checkout são os da loja real (ver utils/alias-vitrines.ts).
 */

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Barlow_Condensed, Manrope } from 'next/font/google';
import type { ItemCardapio } from '@/types/database';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';
import { obterStatusFuncionamento } from '@/utils/horario-funcionamento';
import { obterConfigLojaEspecial } from '@/utils/config-lojas-especiais';
import { montarUrlWhatsappComMensagem } from '@/utils/whatsapp';
import { trackContatoWhatsApp } from '@/utils/meta-pixel';
import { resolverSlugLoja } from '@/utils/alias-vitrines';
import type { ComponenteLojaProps } from '@/components/ecommerce/temas/SeletorLojaPublica';
import { AcaoItem } from './perucho-versoes/AcaoItem';
import { FolhaAdicionais } from './perucho-versoes/FolhaAdicionais';
import { FotoItem } from './perucho-versoes/FotoItem';
import { formatarMoeda, produtoDisponivelHoje } from './perucho-versoes/dados';
import { useVitrine } from './perucho-versoes/useVitrine';
import estilos from './ComponenteLojaPeruchoBurguerParrilla.module.css';

const fonteTitulo = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--v-fonte-titulo', display: 'swap' });
const fonteCorpo = Manrope({ subsets: ['latin'], variable: '--v-fonte-corpo', display: 'swap' });

const CLASSES_ACAO_GRANDE = { botao: estilos.botaoAdd, stepper: estilos.stepper, selo: estilos.selo, maisBotao: estilos.maisBotao };
const CLASSES_ACAO_LISTA = { botao: estilos.botaoMais, stepper: estilos.stepper, selo: estilos.selo, maisBotao: estilos.maisBotao };

function IconeWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export default function ComponenteLojaPeruchoBurguerParrilla({ restaurante, produtos }: ComponenteLojaProps) {
  const params = useParams();
  const slugReal = resolverSlugLoja((params?.slug as string) || '');
  const { grupos, categoriaAtiva, irParaCategoria, secoesRef, abasRef, barraAbasRef } = useVitrine(produtos);
  const [produtoEmEscolha, setProdutoEmEscolha] = useState<ItemCardapio | null>(null);
  const fecharFolha = useCallback(() => setProdutoEmEscolha(null), [setProdutoEmEscolha]);

  const status = obterStatusFuncionamento(restaurante.horariosFuncionamento);
  const nome = restaurante.nome || 'Perucho Burguer';
  // A etiqueta [site v3] na mensagem mostra, na própria conversa, quem veio por esta versão da vitrine.
  const urlWhatsapp = montarUrlWhatsappComMensagem(
    obterConfigLojaEspecial(slugReal).whatsappAtendimento,
    `Olá! Vim pelo site da ${nome} e quero fazer um pedido. [site v3]`
  );

  const acao = (produto: ItemCardapio, classes: typeof CLASSES_ACAO_GRANDE, rotulo: string) => (
    <AcaoItem
      produto={produto}
      temAdicionais={(produto.complementos_produto ?? []).some((c) => c.disponivel)}
      rotulo={rotulo}
      classes={classes}
      onEscolher={setProdutoEmEscolha}
    />
  );

  const cartaoGrande = (produto: ItemCardapio, classeCartao: string, subtitulo: string, sizes: string) => {
    const disponivel = produtoDisponivelHoje(produto);
    return (
      <article key={produto.id} className={`${classeCartao} ${disponivel ? '' : estilos.indisponivel}`}>
        <div className={estilos.foto}>
          <FotoItem className={estilos.fotoImagem} classeSemFoto={estilos.fotoImagem} src={produto.imagem_url} alt={produto.nome} sizes={sizes} />
          <span className={estilos.etiqueta}>{formatarMoeda(Number(produto.preco_venda))}</span>
          <h3>{produto.nome}</h3>
        </div>
        <div className={estilos.corpo}>
          <p>{produto.descricao}</p>
          <div className={estilos.linhaAcao}>
            <span className={estilos.subtitulo}>{subtitulo}</span>
            {disponivel ? acao(produto, CLASSES_ACAO_GRANDE, 'Adicionar') : <span className={estilos.aviso}>Indisponível hoje</span>}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className={`${estilos.raiz} ${fonteTitulo.variable} ${fonteCorpo.variable}`}>
      <div className={estilos.pagina}>
        <header className={estilos.hero}>
          <div className={estilos.topo}>
            <Image src="/perucho-burguer-logo.webp" alt="" width={96} height={96} className={estilos.logo} priority />
            <span className={estilos.espaco} />
            {urlWhatsapp && (
              <a
                href={urlWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={estilos.whatsapp}
                onClick={() => trackContatoWhatsApp({ origem: 'vitrine_v3' })}
              >
                <IconeWhatsApp />
                Pedir no WhatsApp
              </a>
            )}
          </div>
          <h1 className="sr-only">{nome}</h1>
          <Image
            src="/perucho-burguer-banner.webp"
            alt="Perucho Burguer, sabores del Perú: hambúrguer artesanal, batatas rústicas e chicha morada"
            width={1242}
            height={689}
            sizes="(max-width: 560px) 100vw, 560px"
            className={estilos.banner}
            priority
          />
        </header>

        <div className={estilos.info}>
          <span className={estilos.pilula} data-aberto={status.aberto}>
            <i className={estilos.ponto} />
            <span suppressHydrationWarning>{status.texto}</span>
          </span>
          <span className={estilos.pilula}>20–60 min</span>
        </div>

        {grupos.length > 0 && (
          <nav className={estilos.abas} aria-label="Categorias do cardápio">
            <div ref={barraAbasRef} className={estilos.abasInterno}>
              {grupos.map((grupo) => {
                const ativa = categoriaAtiva === grupo.chave;
                return (
                  <a
                    key={grupo.chave}
                    ref={(el) => {
                      if (el) abasRef.current[grupo.chave] = el;
                    }}
                    href={`#${grupo.chave.toLowerCase()}`}
                    className={`${estilos.aba} ${ativa ? estilos.abaAtiva : ''}`}
                    aria-current={ativa ? 'true' : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      irParaCategoria(grupo.chave);
                    }}
                  >
                    {grupo.rotulo}
                  </a>
                );
              })}
            </div>
          </nav>
        )}

        <main className={estilos.menu}>
          {grupos.length === 0 && <p className={estilos.vazio}>Cardápio na chapa — volte em breve.</p>}
          {grupos.map((grupo) => (
            <section
              key={grupo.chave}
              id={grupo.chave.toLowerCase()}
              data-categoria={grupo.chave}
              ref={(el) => {
                if (el) secoesRef.current[grupo.chave] = el;
              }}
            >
              <h2>{grupo.rotulo}</h2>

              {grupo.chave === 'COMBOS' && (
                <div className={estilos.carrossel}>
                  {grupo.produtos.map((produto) => cartaoGrande(produto, estilos.combo, 'Combo completo', '310px'))}
                </div>
              )}

              {grupo.chave === 'HAMBURGUERES' && (
                <div className={estilos.carrossel}>
                  {grupo.produtos.map((produto) => cartaoGrande(produto, estilos.hamburguer, 'Com adicionais', '240px'))}
                </div>
              )}

              {grupo.chave !== 'COMBOS' && grupo.chave !== 'HAMBURGUERES' && (
                <div className={estilos.lista}>
                  {grupo.produtos.map((produto) => {
                    const disponivel = produtoDisponivelHoje(produto);
                    return (
                      <article key={produto.id} className={`${estilos.linha} ${disponivel ? '' : estilos.indisponivel}`}>
                        <FotoItem className={estilos.miniatura} classeSemFoto={estilos.miniatura} src={produto.imagem_url} alt={produto.nome} sizes="64px" />
                        <div className={estilos.corpoLinha}>
                          <h3>{produto.nome}</h3>
                          {grupo.chave !== 'BEBIDAS' && produto.descricao && <p>{produto.descricao}</p>}
                          <span className={estilos.precoLinha}>{formatarMoeda(Number(produto.preco_venda))}</span>
                        </div>
                        {disponivel ? acao(produto, CLASSES_ACAO_LISTA, '+') : <span className={estilos.aviso}>Indisponível hoje</span>}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </main>

        <footer className={estilos.rodape}>
          <b>Sabor de verdade em cada mordida.</b>
          <span>
            {restaurante.endereco?.trim() ? `${restaurante.endereco.trim()} · ` : ''}Peça por aqui{urlWhatsapp ? ' ou pelo WhatsApp' : ''}.
          </span>
        </footer>

        <BarraCarrinhoFlutuante corBotaoAcao="#2A1A14" corBadgeFundo="#F2A02E" corBadgeTexto="#2A1A14" />
      </div>

      {produtoEmEscolha && <FolhaAdicionais produto={produtoEmEscolha} onFechar={fecharFolha} />}
    </div>
  );
}
