'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ItemCardapio } from '@/types/database';
import { Complemento, useCarrinho } from './ContextoCarrinho';

interface CardProps {
  produto: ItemCardapio;
}

export default function CartaoItemCardapio({ produto }: CardProps) {
  const { adicionarItem, itens, removerItem } = useCarrinho();
  const [sanfonaAberta, setSanfonaAberta] = useState(false);
  const [complementosSelecionadosIds, setComplementosSelecionadosIds] = useState<string[]>([]);

  const complementosDisponiveis = (produto.complementos_produto || []).filter((complemento) => complemento.disponivel);
  const complementosSelecionados = complementosDisponiveis
    .filter((complemento) => complementosSelecionadosIds.includes(complemento.id))
    .map<Complemento>((complemento) => ({
      id: complemento.id,
      item_cardapio_id: complemento.item_cardapio_id || produto.id,
      nome: complemento.nome,
      preco_adicional: Number(complemento.preco_adicional),
      disponivel: complemento.disponivel,
    }));

  const adicionaisIds = complementosSelecionados.map((adicional) => adicional.id).sort().join('-');
  const idUnicoCarrinho = adicionaisIds ? `${produto.id}-${adicionaisIds}` : produto.id;
  const itemNoCarrinho = itens.find((item) => item.idUnico === idUnicoCarrinho);
  const qtd = itemNoCarrinho?.quantidade || 0;

  const valorComplementosSelecionados = complementosSelecionados.reduce(
    (acc, adicional) => acc + Number(adicional.preco_adicional),
    0
  );

  const toggleComplemento = (complementoId: string) => {
    setComplementosSelecionadosIds((idsAtuais) =>
      idsAtuais.includes(complementoId)
        ? idsAtuais.filter((id) => id !== complementoId)
        : [...idsAtuais, complementoId]
    );
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-[20px] shadow-sm overflow-hidden transition-all">
      <div
        onClick={() => setSanfonaAberta(!sanfonaAberta)}
        className="p-4 flex gap-4 items-center cursor-pointer select-none hover:bg-zinc-50/80 transition-colors"
      >
        <div className="w-[88px] h-[88px] rounded-2xl flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-600 shadow-inner overflow-hidden">
          {produto.imagem_url ? (
            <Image
              src={produto.imagem_url}
              alt={`Foto do produto ${produto.nome}`}
              className="w-full h-full object-cover"
              width={72}
              height={72}
              loading="lazy"
            />
          ) : (
            <span className="text-3xl">🍔</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-thin text-zinc-950 truncate text-base leading-tight">
            {produto.nome}
          </h3>
          <p className="text-zinc-600 text-xs mt-1 line-clamp-2 leading-relaxed font-thin">
            {produto.descricao || 'Receita artesanal montada com insumos selecionados.'}
          </p>
          <span className="font-thin text-[#D92B24] text-[24px] block mt-2 leading-none">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(produto.preco_venda))}
          </span>
        </div>

        <div className="shrink-0 p-1 text-[#D92B24]">
          <svg
            className={`w-6 h-6 transform transition-transform duration-200 ${sanfonaAberta ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {sanfonaAberta && (
        <div className="border-t border-zinc-200 bg-white p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex justify-between items-center select-none">
            <span className="text-xs font-thin text-zinc-700">Adicionais</span>
            {qtd > 0 && (
              <span className="text-[10px] font-thin text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                Item na sacola
              </span>
            )}
          </div>

          <div className="space-y-2">
            {complementosDisponiveis.length === 0 ? (
              <div className="bg-white border border-zinc-200/40 rounded-xl p-3 text-[11px] font-thin text-zinc-500">
                Este item não possui complementos no momento.
              </div>
            ) : (
              complementosDisponiveis.map((complemento) => {
                const selecionado = complementosSelecionadosIds.includes(complemento.id);
                return (
                  <label
                    key={complemento.id}
                    className={`w-full bg-white border rounded-xl p-3 flex justify-between items-center shadow-2xs transition-all ${
                      selecionado ? 'border-[#E52521]' : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={() => toggleComplemento(complemento.id)}
                        className="h-5 w-5 accent-[#E52521] rounded border-zinc-300"
                      />
                      <div className="text-left min-w-0">
                        <span className="text-xs font-thin text-zinc-800 block truncate">{complemento.nome}</span>
                      </div>
                    </div>
                    <span className="text-xs font-thin text-zinc-700">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(complemento.preco_adicional))}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {complementosSelecionados.length > 0 && (
            <div className="text-xs font-thin text-zinc-600 flex justify-between">
              <span>Complementos selecionados</span>
              <span className="font-mono">
                + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorComplementosSelecionados)}
              </span>
            </div>
          )}

          <div className="pt-2 flex justify-between items-center border-t border-zinc-100/80">
            <span className="text-xs font-thin text-zinc-600">Quantidade</span>
            {qtd > 0 ? (
              <div className="flex items-center bg-zinc-100 border border-zinc-200/40 rounded-xl p-0.5 gap-2.5">
                <button
                  type="button"
                  onClick={() => removerItem(idUnicoCarrinho)}
                  className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-sm font-thin text-zinc-600 hover:bg-zinc-200 shadow-2xs transition-colors"
                >
                  -
                </button>
                <span className="text-sm font-thin px-0.5 text-zinc-800 font-mono">{qtd}</span>
                <button
                  type="button"
                  onClick={() => adicionarItem(produto, complementosSelecionados)}
                  className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center text-sm font-thin text-white hover:bg-zinc-800 shadow-2xs transition-colors"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => adicionarItem(produto, complementosSelecionados)}
                className="bg-[#FFC72C] hover:bg-[#E9B31E] text-zinc-900 font-thin text-sm px-6 py-2.5 rounded-xl transition-all tracking-wide border border-[#E9B31E]"
              >
                Adicionar à sacola
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
