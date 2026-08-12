'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { trackAddToCart } from '@/utils/meta-pixel';

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

interface ContextoCarrinhoType {
  itens: ItemCarrinho[];
  adicionarItem: (produto: ItemCardapio, adicionais?: Complemento[]) => void;
  removerItem: (idUnico: string) => void;
  valorTotal: number;
  totalItens: number;
  limparCarrinho: () => void;
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
  const slugAtual = (params?.slug as string) || '';
  const chaveCarrinhoAtual = montarChaveCarrinho(slugAtual);

  const [itens, setItens] = useState<ItemCarrinho[]>(() => lerCarrinhoDoStorage(chaveCarrinhoAtual));
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
    try {
      window.localStorage.removeItem(chaveCarrinhoAtual);
    } catch (error) {
      console.error('Falha ao limpar carrinho do localStorage:', error);
    }
  };

  const valorTotal = itens.reduce((acc, item) => acc + (item.produto.preco_venda * item.quantidade), 0);
  const totalItens = itens.reduce((acc, item) => acc + item.quantidade, 0);

  return (
    <ContextoCarrinho.Provider value={{ itens, adicionarItem, removerItem, valorTotal, totalItens, limparCarrinho }}>
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
