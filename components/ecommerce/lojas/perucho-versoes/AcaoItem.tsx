'use client';

import { useCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import type { ItemCardapio } from '@/types/database';

interface AcaoItemProps {
  produto: ItemCardapio;
  /** Item com adicionais: o botão abre a folha de escolha em vez de adicionar direto. */
  temAdicionais: boolean;
  rotulo: string;
  classes: { botao: string; stepper: string; selo: string; maisBotao: string };
  onEscolher: (produto: ItemCardapio) => void;
}

/** Botão "Adicionar" (ou "+") e o contador de quantidade do item, ligados ao carrinho. */
export function AcaoItem({ produto, temAdicionais, rotulo, classes, onEscolher }: AcaoItemProps) {
  const { itens, adicionarItem, removerItem } = useCarrinho();
  const linhas = itens.filter((item) => item.produto.id === produto.id);
  const quantidade = linhas.reduce((total, item) => total + item.quantidade, 0);

  if (temAdicionais) {
    return (
      <button
        type="button"
        className={classes.botao}
        onClick={() => onEscolher(produto)}
        aria-label={`Escolher ${produto.nome}${quantidade > 0 ? ` (${quantidade} na sacola)` : ''}`}
      >
        {rotulo}
        {quantidade > 0 && <i className={classes.selo}>{quantidade}</i>}
      </button>
    );
  }

  if (quantidade > 0) {
    return (
      <span className={classes.stepper}>
        <button type="button" onClick={() => removerItem(produto.id)} aria-label={`Remover um ${produto.nome}`}>
          −
        </button>
        <b aria-live="polite">{quantidade}</b>
        <button
          type="button"
          className={classes.maisBotao}
          onClick={() => adicionarItem(produto)}
          aria-label={`Adicionar mais um ${produto.nome}`}
        >
          +
        </button>
      </span>
    );
  }

  return (
    <button type="button" className={classes.botao} onClick={() => adicionarItem(produto)} aria-label={`Adicionar ${produto.nome}`}>
      {rotulo}
    </button>
  );
}
