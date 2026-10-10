'use client';

import { useEffect, useRef, useState } from 'react';
import { useCarrinho, type Complemento } from '@/components/ecommerce/ContextoCarrinho';
import type { ComplementoProduto, ItemCardapio } from '@/types/database';
import { FotoItem } from './FotoItem';
import { formatarMoeda } from './dados';
import estilos from './FolhaAdicionais.module.css';

interface FolhaAdicionaisProps {
  produto: ItemCardapio;
  onFechar: () => void;
}

/**
 * Folha que sobe de baixo para escolher os adicionais e a quantidade antes de pôr o item na sacola.
 * As cores vêm de variáveis CSS definidas pela versão de design que a abriu (ver .raiz de cada versão).
 */
export function FolhaAdicionais({ produto, onFechar }: FolhaAdicionaisProps) {
  const { adicionarItem } = useCarrinho();
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [quantidade, setQuantidade] = useState(1);
  const painelRef = useRef<HTMLDivElement | null>(null);
  const idTitulo = `folha-titulo-${produto.id}`;

  const disponiveis = (produto.complementos_produto ?? []).filter((c) => c.disponivel);
  const grupos = disponiveis.reduce<{ titulo: string; itens: ComplementoProduto[] }[]>((acc, complemento) => {
    const titulo = complemento.grupo?.trim() || 'Adicionais';
    const existente = acc.find((g) => g.titulo === titulo);
    if (existente) existente.itens.push(complemento);
    else acc.push({ titulo, itens: [complemento] });
    return acc;
  }, []);

  const escolhidos = disponiveis.filter((c) => selecionados.includes(c.id));
  const valorUnitario = Number(produto.preco_venda) + escolhidos.reduce((soma, c) => soma + Number(c.preco_adicional), 0);

  // trava a rolagem da página, fecha no Esc e devolve o foco ao botão que abriu a folha
  useEffect(() => {
    const focoAnterior = document.activeElement as HTMLElement | null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    painelRef.current?.focus();

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        onFechar();
        return;
      }
      if (evento.key !== 'Tab' || !painelRef.current) return;
      const focaveis = painelRef.current.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', aoTeclar);

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
      focoAnterior?.focus?.();
    };
  }, [onFechar]);

  const alternar = (id: string) =>
    setSelecionados((atuais) => (atuais.includes(id) ? atuais.filter((outro) => outro !== id) : [...atuais, id]));

  const confirmar = () => {
    const complementos = escolhidos.map<Complemento>((c) => ({
      id: c.id,
      item_cardapio_id: c.item_cardapio_id || produto.id,
      nome: c.nome,
      preco_adicional: Number(c.preco_adicional),
      disponivel: c.disponivel,
      grupo: c.grupo ?? null,
    }));
    for (let i = 0; i < quantidade; i += 1) adicionarItem(produto, complementos);
    onFechar();
  };

  return (
    <div className={estilos.folha}>
      <div className={estilos.cortina} onClick={onFechar} aria-hidden />
      <div ref={painelRef} className={estilos.painel} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}>
        <div className={estilos.alca} aria-hidden />
        <button type="button" className={estilos.fechar} onClick={onFechar} aria-label="Fechar">
          ×
        </button>

        <div className={estilos.topo}>
          <FotoItem className={estilos.foto} src={produto.imagem_url} alt="" sizes="104px" />
          <div className={estilos.textoTopo}>
            <h3 id={idTitulo}>{produto.nome}</h3>
            <p>{produto.descricao}</p>
            <b className={estilos.preco}>{formatarMoeda(Number(produto.preco_venda))}</b>
          </div>
        </div>

        {grupos.map((grupo) => (
          <div key={grupo.titulo}>
            <h4 className={estilos.titulo}>{grupo.titulo}</h4>
            <div className={estilos.chips}>
              {grupo.itens.map((complemento) => {
                const ligado = selecionados.includes(complemento.id);
                return (
                  <button
                    key={complemento.id}
                    type="button"
                    className={`${estilos.chip} ${ligado ? estilos.chipLigado : ''}`}
                    aria-pressed={ligado}
                    onClick={() => alternar(complemento.id)}
                  >
                    {complemento.nome}
                    <small>+{formatarMoeda(Number(complemento.preco_adicional))}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className={estilos.rodape}>
          <span className={estilos.stepper}>
            <button type="button" onClick={() => setQuantidade((q) => Math.max(1, q - 1))} aria-label="Menos um">
              −
            </button>
            <b aria-live="polite">{quantidade}</b>
            <button type="button" onClick={() => setQuantidade((q) => q + 1)} aria-label="Mais um">
              +
            </button>
          </span>
          <button type="button" className={estilos.confirmar} onClick={confirmar}>
            <span>Adicionar</span>
            <b>{formatarMoeda(valorUnitario * quantidade)}</b>
          </button>
        </div>
      </div>
    </div>
  );
}
