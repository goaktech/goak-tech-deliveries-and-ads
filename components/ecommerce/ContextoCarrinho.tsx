'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { trackAddToCart } from '@/utils/meta-pixel';
import { resolverSlugLoja } from '@/utils/alias-vitrines';

export interface Complemento {
  id: string;
  item_cardapio_id: string;
  nome: string;
  preco_adicional: number;
  disponivel: boolean;
  grupo?: string | null;
}

export interface ItemCardapio {
  id: string;
  restaurante_id: string;
  nome: string;
  descricao: string | null;
  preco_venda: number;
  disponivel: boolean;
  imagem_url: string | null;
  complementos?: Complemento[];
}

export interface ItemCarrinho {
  idUnico: string;
  produto: ItemCardapio;
  quantidade: number;
  adicionaisEscolhidos: Complemento[];
}

/** Resultado da conferência da sacola com o cardápio de agora (POST /api/checkout/validar). */
export interface AvaliacaoItemCarrinho {
  idUnico?: string;
  item_cardapio_id: string;
  nome: string;
  status: 'ok' | 'preco_menor' | 'preco_mantido' | 'preco_alterado' | 'indisponivel' | 'adicional_indisponivel';
  precoVisto: number | null;
  precoAtual: number;
  precoCobrado: number;
  adicionais: Array<{ id: string; nome: string; preco_adicional: number }>;
}

export interface AvisoCarrinho {
  idUnico: string;
  tipo: 'info' | 'atencao' | 'bloqueio';
  texto: string;
}

interface ContextoCarrinhoType {
  itens: ItemCarrinho[];
  adicionarItem: (produto: ItemCardapio, adicionais?: Complemento[]) => void;
  removerItem: (idUnico: string) => void;
  valorTotal: number;
  totalItens: number;
  limparCarrinho: () => void;
  /** Remove a linha inteira (todas as unidades) da sacola. */
  removerLinha: (idUnico: string) => void;
  /** Avisos sobre preços/itens que mudaram desde que o cliente montou a sacola. */
  avisosCarrinho: AvisoCarrinho[];
  /** Aplica o resultado da conferência: atualiza preços e gera os avisos. */
  aplicarAvaliacao: (avaliacoes: AvaliacaoItemCarrinho[]) => void;
}

const ContextoCarrinho = createContext<ContextoCarrinhoType | undefined>(undefined);
const PREFIXO_STORAGE_CARRINHO = 'acelera-food:carrinho';

function montarChaveCarrinho(slug: string) {
  return `${PREFIXO_STORAGE_CARRINHO}:${slug || 'sem-loja'}`;
}

function lerCarrinhoDoStorage(chave: string): ItemCarrinho[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const carrinhoSalvo = window.localStorage.getItem(chave);
    if (!carrinhoSalvo) {
      return [];
    }

    const parsed = JSON.parse(carrinhoSalvo) as ItemCarrinho[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Falha ao restaurar carrinho do localStorage:', error);
    return [];
  }
}

export function ProvedorCarrinho({ children }: { children: React.ReactNode }) {
  const params = useParams();
  // Versões alternativas de design (ex.: perucho-burguer-v2) usam o carrinho da loja real.
  const slugAtual = resolverSlugLoja((params?.slug as string) || '');
  const chaveCarrinhoAtual = montarChaveCarrinho(slugAtual);

  const [itens, setItens] = useState<ItemCarrinho[]>(() => lerCarrinhoDoStorage(chaveCarrinhoAtual));
  const [avisosCarrinho, setAvisosCarrinho] = useState<AvisoCarrinho[]>([]);
  const chaveCarregadaRef = useRef(chaveCarrinhoAtual);

  useEffect(() => {
    if (chaveCarregadaRef.current !== chaveCarrinhoAtual) {
      chaveCarregadaRef.current = chaveCarrinhoAtual;
      setItens(lerCarrinhoDoStorage(chaveCarrinhoAtual));
    }
  }, [chaveCarrinhoAtual]);

  useEffect(() => {
    if (chaveCarregadaRef.current !== chaveCarrinhoAtual) {
      return;
    }

    try {
      window.localStorage.setItem(chaveCarrinhoAtual, JSON.stringify(itens));
    } catch (error) {
      console.error('Falha ao persistir carrinho no localStorage:', error);
    }
  }, [itens, chaveCarrinhoAtual]);

  const adicionarItem = (produto: ItemCardapio, adicionais: Complemento[] = []) => {
    const adicionaisIds = adicionais.map(a => a.id).sort().join('-');
    const idUnico = adicionaisIds ? `${produto.id}-${adicionaisIds}` : produto.id;
    const precoAdicionais = adicionais.reduce((acc, a) => acc + Number(a.preco_adicional), 0);
    const precoFinal = Number(produto.preco_venda) + precoAdicionais;

    setItens((itensAtuais) => {
      const itemExistente = itensAtuais.find((item) => item.idUnico === idUnico);

      if (itemExistente) {
        return itensAtuais.map((item) =>
          item.idUnico === idUnico ? { ...item, quantidade: item.quantidade + 1 } : item
        );
      }

      return [
        ...itensAtuais,
        {
          idUnico,
          produto: { ...produto, preco_venda: precoFinal },
          quantidade: 1,
          adicionaisEscolhidos: adicionais
        }
      ];
    });

    trackAddToCart({ id: produto.id, nome: produto.nome, valor: precoFinal, quantidade: 1 });
  };

  const removerItem = (idUnico: string) => {
    setItens((itensAtuais) => {
      const itemExistente = itensAtuais.find((item) => item.idUnico === idUnico);

      if (itemExistente && itemExistente.quantidade > 1) {
        return itensAtuais.map((item) =>
          item.idUnico === idUnico ? { ...item, quantidade: item.quantidade - 1 } : item
        );
      }

      return itensAtuais.filter((item) => item.idUnico !== idUnico);
    });
  };

  const limparCarrinho = () => {
    setItens([]);
    setAvisosCarrinho([]);
    try {
      window.localStorage.removeItem(chaveCarrinhoAtual);
    } catch (error) {
      console.error('Falha ao limpar carrinho do localStorage:', error);
    }
  };

  const removerLinha = (idUnico: string) => {
    setItens((itensAtuais) => itensAtuais.filter((item) => item.idUnico !== idUnico));
    setAvisosCarrinho((avisos) => avisos.filter((aviso) => aviso.idUnico !== idUnico));
  };

  const aplicarAvaliacao = (avaliacoes: AvaliacaoItemCarrinho[]) => {
    const novosAvisos: AvisoCarrinho[] = [];
    const formatar = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const mapa = new Map(avaliacoes.filter((a) => a.idUnico).map((a) => [a.idUnico as string, a]));

    setItens((itensAtuais) =>
      itensAtuais.map((item) => {
        const avaliacao = mapa.get(item.idUnico);
        if (!avaliacao) return item;
        const nome = item.produto.nome;
        if (avaliacao.status === 'indisponivel') {
          novosAvisos.push({ idUnico: item.idUnico, tipo: 'bloqueio', texto: `${nome} não está mais disponível. Remova da sacola para continuar.` });
          return item;
        }
        if (avaliacao.status === 'adicional_indisponivel') {
          novosAvisos.push({ idUnico: item.idUnico, tipo: 'bloqueio', texto: `Um adicional de ${nome} não está mais disponível. Remova o item e adicione de novo.` });
          return item;
        }
        if (avaliacao.status === 'preco_mantido') {
          novosAvisos.push({
            idUnico: item.idUnico,
            tipo: 'info',
            texto: `${nome}: o preço mudou para ${formatar(avaliacao.precoAtual)}, mas mantivemos ${formatar(avaliacao.precoCobrado)}, o valor que você viu, até o fim do expediente de hoje.`,
          });
          return item;
        }
        if (avaliacao.status === 'ok') return item;

        // preço mudou (para mais ou para menos): atualiza a sacola e avisa; adicionais podem ter ganho ids novos
        const atualizado: ItemCarrinho = {
          ...item,
          produto: { ...item.produto, preco_venda: avaliacao.precoAtual },
          adicionaisEscolhidos: item.adicionaisEscolhidos.map((adicional) => {
            const resolvido = avaliacao.adicionais.find((r) => r.nome.trim().toLowerCase() === adicional.nome.trim().toLowerCase());
            return resolvido ? { ...adicional, id: resolvido.id, preco_adicional: resolvido.preco_adicional } : adicional;
          }),
        };
        const antes = avaliacao.precoVisto ?? item.produto.preco_venda;
        novosAvisos.push({
          idUnico: item.idUnico,
          tipo: avaliacao.status === 'preco_menor' ? 'info' : 'atencao',
          texto:
            avaliacao.status === 'preco_menor'
              ? `${nome} ficou mais barato: de ${formatar(antes)} para ${formatar(avaliacao.precoAtual)}.`
              : `O preço de ${nome} foi atualizado de ${formatar(antes)} para ${formatar(avaliacao.precoAtual)}. Confira o total antes de pagar.`,
        });
        return atualizado;
      })
    );
    setAvisosCarrinho(novosAvisos);
  };

  const aplicarAvaliacaoRef = useRef(aplicarAvaliacao);
  useEffect(() => {
    aplicarAvaliacaoRef.current = aplicarAvaliacao;
  });

  // Ao abrir a loja com a sacola já montada (de outro dia/aparelho), confere preços e itens com o cardápio de agora
  // e avisa o cliente do que mudou. O servidor confere de novo ao cobrar (utils/politica-preco.ts).
  const itensAoAbrirRef = useRef(itens);
  useEffect(() => {
    const itensConferir = itensAoAbrirRef.current;
    if (!slugAtual || itensConferir.length === 0) return;
    let ativo = true;
    const conferir = async () => {
      try {
        const resposta = await fetch('/api/checkout/validar', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            slug: slugAtual,
            itens: itensConferir.map((item) => ({
              idUnico: item.idUnico,
              item_cardapio_id: item.produto.id,
              quantidade: item.quantidade,
              complementoIds: item.adicionaisEscolhidos.map((a) => a.id),
              adicionaisVistos: item.adicionaisEscolhidos.map((a) => ({ id: a.id, nome: a.nome })),
              precoVisto: Number(item.produto.preco_venda),
            })),
          }),
        });
        const body = await resposta.json().catch(() => null);
        if (ativo && resposta.ok && Array.isArray(body?.itens)) {
          aplicarAvaliacaoRef.current(body.itens as AvaliacaoItemCarrinho[]);
        }
      } catch {
        // sem rede: o checkout confere de novo
      }
    };
    void conferir();
    return () => {
      ativo = false;
    };
  }, [slugAtual]);

  const valorTotal = itens.reduce((acc, item) => acc + (item.produto.preco_venda * item.quantidade), 0);
  const totalItens = itens.reduce((acc, item) => acc + item.quantidade, 0);

  return (
    <ContextoCarrinho.Provider value={{ itens, adicionarItem, removerItem, valorTotal, totalItens, limparCarrinho, removerLinha, avisosCarrinho, aplicarAvaliacao }}>
      {children}
    </ContextoCarrinho.Provider>
  );
}

export function useCarrinho() {
  const context = useContext(ContextoCarrinho);
  if (!context) {
    throw new Error('useCarrinho deve ser utilizado dentro de um ProvedorCarrinho');
  }
  return context;
}
