'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Fredoka } from 'next/font/google';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import BarraCarrinhoFlutuante from '@/components/ecommerce/BarraCarrinhoFlutuante';

const fonteGroovy = Fredoka({ subsets: ['latin'], weight: ['600', '700'] });

interface ComponenteLojaPastelECiaProps {
  restaurante: { id: string; nome: string; endereco: string | null };
  produtos: ItemCardapio[];
}

const COR_TERRACOTA = '#DD6B45';
const COR_TERRACOTA_ESCURO = '#B8532F';
const COR_CREME = '#FBF0DF';
const COR_PRETO = '#221E19';
const COR_FUNDO_PAGINA = '#FAF3E6';

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function OndaGotejante({ className, espelhar = false }: { className?: string; espelhar?: boolean }) {
  return (
    <svg
      viewBox="0 0 220 90"
      className={className}
      style={espelhar ? { transform: 'scale(-1, -1)' } : undefined}
      aria-hidden
    >
      <path
        d="M0,0 L220,0 L220,20 C205,45 195,10 180,30 C165,50 155,15 140,32 C125,49 115,18 100,34 C85,50 75,20 60,36 C45,52 35,22 20,38 C10,48 4,42 0,34 Z"
        fill={COR_TERRACOTA}
        stroke={COR_PRETO}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MascotePastelzinho() {
  return (
    <svg viewBox="0 0 100 100" className="h-16 w-16 shrink-0" aria-hidden>
      <path
        d="M50,10 L88,70 C90,74 88,78 84,78 L16,78 C12,78 10,74 12,70 Z"
        fill={COR_CREME}
        stroke={COR_PRETO}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M16,78 Q22,84 28,78 Q34,84 40,78 Q46,84 50,78 Q54,84 60,78 Q66,84 72,78 Q78,84 84,78"
        fill="none"
        stroke={COR_PRETO}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="28" y="40" width="18" height="12" rx="4" fill={COR_PRETO} />
      <rect x="54" y="40" width="18" height="12" rx="4" fill={COR_PRETO} />
      <line x1="46" y1="45" x2="54" y2="45" stroke={COR_PRETO} strokeWidth="3" />
      <path d="M40,60 Q50,68 60,60" fill="none" stroke={COR_PRETO} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M18,66 Q10,60 16,50" fill="none" stroke={COR_PRETO} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M82,66 Q90,60 84,50" fill="none" stroke={COR_PRETO} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

interface CartaoProdutoPastelProps {
  produto: ItemCardapio;
  expandido: boolean;
  onToggleExpandir: () => void;
}

function CartaoProdutoPastel({ produto, expandido, onToggleExpandir }: CartaoProdutoPastelProps) {
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
    <div
      className="overflow-hidden rounded-[26px] bg-white transition-all duration-300"
      style={{ border: `3px solid ${COR_PRETO}`, boxShadow: `4px 4px 0 ${COR_PRETO}` }}
    >
      <button
        type="button"
        onClick={temComplementos ? onToggleExpandir : undefined}
        className={`flex w-full items-center gap-4 p-4 text-left transition-colors ${
          expandido ? 'bg-[#FBEADF]' : temComplementos ? 'hover:bg-zinc-50' : ''
        }`}
      >
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
          style={{ backgroundColor: COR_CREME, border: `2.5px solid ${COR_PRETO}` }}
        >
          {produto.imagem_url ? (
            <Image src={produto.imagem_url} alt={produto.nome} width={64} height={64} className="h-full w-full object-cover" unoptimized />
          ) : (
            <span className="text-2xl" aria-hidden>🥟</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className={`${fonteGroovy.className} truncate text-base text-zinc-900`}>{produto.nome}</h3>
          <p className="mt-0.5 truncate text-xs text-zinc-400">{produto.descricao || 'Feito na hora, na frigideira.'}</p>
        </div>

        <span
          className={`${fonteGroovy.className} shrink-0 rounded-full px-3 py-1.5 text-sm text-white`}
          style={{ backgroundColor: COR_TERRACOTA, border: `2px solid ${COR_PRETO}` }}
        >
          {formatarMoeda(Number(produto.preco_venda))}
        </span>
      </button>

      {expandido && temComplementos && (
        <div className="animate-in fade-in space-y-4 border-t-[3px] p-4 duration-200" style={{ borderColor: COR_PRETO }}>
          <div className="space-y-2">
            <span className={`${fonteGroovy.className} text-xs uppercase tracking-wide`} style={{ color: COR_TERRACOTA_ESCURO }}>
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
                    className="rounded-2xl px-3 py-2 text-center transition-all"
                    style={
                      selecionado
                        ? { backgroundColor: COR_PRETO, borderColor: COR_PRETO, border: '2.5px solid', color: '#fff' }
                        : { backgroundColor: '#fff', border: `2.5px solid ${COR_PRETO}`, color: '#3f3f46' }
                    }
                  >
                    <span className="block truncate text-[11px] font-bold leading-tight">{complemento.nome}</span>
                    <span className={`mt-0.5 block text-[10px] ${selecionado ? 'text-white/80' : 'text-zinc-400'}`}>
                      +{formatarMoeda(Number(complemento.preco_adicional))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-dashed pt-3" style={{ borderColor: '#E5D6C2' }}>
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
      <div className="flex items-center gap-2.5 rounded-full bg-white p-1" style={{ border: `2.5px solid ${COR_PRETO}` }}>
        <button
          type="button"
          onClick={() => onRemover(idUnicoCarrinho)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-50 text-sm font-bold text-zinc-600 hover:bg-zinc-100"
        >
          -
        </button>
        <span className="px-0.5 font-mono text-sm font-bold text-zinc-800">{qtd}</span>
        <button
          type="button"
          onClick={() => onAdicionar(produto, complementosSelecionados)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white"
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
      className={`${fonteGroovy.className} rounded-full px-6 py-2.5 text-xs uppercase tracking-wider text-white transition-all`}
      style={{ backgroundColor: COR_PRETO }}
    >
      Adicionar
    </button>
  );
}

export default function ComponenteLojaPastelECia({ restaurante, produtos }: ComponenteLojaPastelECiaProps) {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { totalItens } = useCarrinho();
  const [produtoExpandidoId, setProdutoExpandidoId] = useState<string | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<'SALGADOS' | 'DOCES' | 'BEBIDAS'>('SALGADOS');

  const alternarExpandido = (produtoId: string) => {
    setProdutoExpandidoId((atual) => (atual === produtoId ? null : produtoId));
  };

  const nomeIndicaDoce = (nome: string) => /banana|chocolate|romeu|morango|doce/i.test(nome);
  const nomeIndicaBebida = (nome: string) => /caldo de cana|guaraná|coca|suco|refrigerante|água/i.test(nome);

  const produtosFiltrados = produtos.filter((produto) => {
    if (categoriaAtiva === 'BEBIDAS') return nomeIndicaBebida(produto.nome);
    if (categoriaAtiva === 'DOCES') return nomeIndicaDoce(produto.nome) && !nomeIndicaBebida(produto.nome);
    return !nomeIndicaDoce(produto.nome) && !nomeIndicaBebida(produto.nome);
  });

  return (
    <div className="min-h-screen antialiased pb-32 font-sans select-none" style={{ backgroundColor: COR_FUNDO_PAGINA }}>
      <div className="relative w-full overflow-hidden" style={{ backgroundColor: COR_FUNDO_PAGINA }}>
        <OndaGotejante className="absolute left-0 top-0 h-20 w-40 sm:h-24 sm:w-48" />
        <OndaGotejante className="absolute bottom-0 right-0 h-20 w-40 sm:h-24 sm:w-48" espelhar />

        <header className="relative z-10 mx-auto flex w-full max-w-xl items-center justify-between px-6 pt-6">
          <button className="text-zinc-900/70 transition-colors hover:text-zinc-900">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href={`/${slug}/checkout`} className="relative text-zinc-900/70 transition-colors hover:text-zinc-900" aria-label="Ver sacola">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
            </svg>
            {totalItens > 0 && (
              <span
                className="absolute -top-2 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none text-white"
                style={{ backgroundColor: COR_TERRACOTA }}
              >
                {totalItens}
              </span>
            )}
          </Link>
        </header>

        <div className="relative z-10 mx-auto mt-6 flex w-full max-w-xl justify-center px-6 pb-10">
          <div
            className="flex items-center gap-3 rounded-[40px] px-5 py-4"
            style={{
              backgroundColor: COR_CREME,
              border: `3.5px solid ${COR_PRETO}`,
              boxShadow: `5px 5px 0 ${COR_TERRACOTA}, 5px 5px 0 3.5px ${COR_PRETO}`,
            }}
          >
            <MascotePastelzinho />
            <div className="leading-[0.85]">
              <h1 className={`${fonteGroovy.className} text-3xl sm:text-4xl`} style={{ color: COR_TERRACOTA }}>
                {restaurante.nome}
              </h1>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
                Pastelaria
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-2 w-full max-w-xl px-6">
        <nav className="mb-5 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {(
            [
              { chave: 'SALGADOS', rotulo: 'Salgados' },
              { chave: 'DOCES', rotulo: 'Doces' },
              { chave: 'BEBIDAS', rotulo: 'Bebidas' },
            ] as const
          ).map((aba) => (
            <button
              key={aba.chave}
              type="button"
              onClick={() => setCategoriaAtiva(aba.chave)}
              className={`${fonteGroovy.className} shrink-0 rounded-full px-4 py-2 text-xs uppercase tracking-wide transition-colors`}
              style={
                categoriaAtiva === aba.chave
                  ? { backgroundColor: COR_TERRACOTA, color: '#fff', border: `2.5px solid ${COR_PRETO}` }
                  : { backgroundColor: '#fff', color: COR_PRETO, border: `2.5px solid ${COR_PRETO}` }
              }
            >
              {aba.rotulo}
            </button>
          ))}
        </nav>

        <div className="space-y-3">
          {produtosFiltrados.length === 0 ? (
            <div
              className="rounded-[26px] bg-white py-16 text-center text-zinc-400"
              style={{ border: `3px dashed ${COR_PRETO}` }}
            >
              <p className="text-xs font-bold">Nada por aqui ainda — confira as outras abas.</p>
            </div>
          ) : (
            produtosFiltrados.map((produto) => (
              <CartaoProdutoPastel
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

      <BarraCarrinhoFlutuante corBotaoAcao={COR_PRETO} corBadgeFundo={COR_TERRACOTA} corBadgeTexto="#fff" />
    </div>
  );
}
