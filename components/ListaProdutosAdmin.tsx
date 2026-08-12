'use client';

import { useOptimistic, useState, useTransition } from 'react';
import {
  ItemCardapioComCMV,
  atualizarStatusEmLote,
  alternarDisponibilidadeProduto,
  excluirProdutosEmLote
} from '@/actions/admin';
import { atualizarOrdemItensCardapio } from '@/actions/cardapio';
import { Insumo } from '@/types/database';
import { useRouter } from 'next/navigation';
import BarraAcoesLote from './cardapio-admin/BarraAcoesLote';
import CardProdutoAdmin from './cardapio-admin/CardProdutoAdmin';
import ModalNovoProduto from './cardapio-admin/ModalNovoProduto';
import ModalEditarProduto from './cardapio-admin/ModalEditarProduto';

interface ListaProdutosProps {
  produtosIniciais: ItemCardapioComCMV[];
  insumosDisponiveis: Insumo[];
}

export default function ListaProdutosAdmin({
  produtosIniciais,
  insumosDisponiveis
}: ListaProdutosProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoParaEditar, setProdutoParaEditar] = useState<ItemCardapioComCMV | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const [produtos, aplicarOrdemOtimista] = useOptimistic(
    produtosIniciais,
    (_estadoAtual, novaOrdem: ItemCardapioComCMV[]) => novaOrdem
  );

  const handleToggleSelect = (id: string) => {
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelecionarTodos = () => {
    if (selecionados.length === produtos.length) {
      setSelecionados([]);
    } else {
      setSelecionados(produtos.map(p => p.id));
    }
  };

  const handleAlterarStatusEmLote = (novoStatus: boolean) => {
    if (selecionados.length === 0) return;
    startTransition(async () => {
      try {
        await atualizarStatusEmLote(selecionados, novoStatus);
        setSelecionados([]);
        router.refresh();
      } catch (err) {
        console.error("Erro na operação em lote:", err);
      }
    });
  };

  const handleExcluirSelecionados = () => {
    if (selecionados.length === 0) return;
    if (!confirm('Deseja apagar os produtos selecionados? Essa ação não pode ser desfeita.')) return;

    startTransition(async () => {
      const resultado = await excluirProdutosEmLote(selecionados);
      if (resultado.success) {
        setSelecionados([]);
        router.refresh();
        return;
      }
      alert(resultado.error || 'Não foi possível apagar os produtos selecionados.');
    });
  };

  const handleAlternarStatusProduto = (id: string, statusAtual: boolean) => {
    startTransition(async () => {
      try {
        await alternarDisponibilidadeProduto(id, statusAtual);
        router.refresh();
      } catch (error) {
        console.error('Erro ao alternar status do produto:', error);
      }
    });
  };

  const handleExcluirProduto = (id: string, nome: string) => {
    if (!confirm(`Deseja apagar o item "${nome}"?`)) return;

    startTransition(async () => {
      const resultado = await excluirProdutosEmLote([id]);
      if (resultado.success) {
        setSelecionados((prev) => prev.filter((itemId) => itemId !== id));
        router.refresh();
        return;
      }
      alert(resultado.error || 'Não foi possível apagar o item.');
    });
  };

  const handleMoverProduto = (indice: number, direcao: -1 | 1) => {
    const novoIndice = indice + direcao;
    if (novoIndice < 0 || novoIndice >= produtos.length) return;

    const reordenados = [...produtos];
    [reordenados[indice], reordenados[novoIndice]] = [reordenados[novoIndice], reordenados[indice]];

    startTransition(async () => {
      aplicarOrdemOtimista(reordenados);
      const resultado = await atualizarOrdemItensCardapio(reordenados.map((p) => p.id));
      if (resultado.success) {
        router.refresh();
        return;
      }
      alert(resultado.error || 'Não foi possível salvar a nova ordem do cardápio.');
    });
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">

      <BarraAcoesLote
        todosSelecionados={selecionados.length === produtos.length && produtos.length > 0}
        onSelecionarTodos={handleSelecionarTodos}
        qtdSelecionados={selecionados.length}
        onAlterarStatus={handleAlterarStatusEmLote}
        onExcluirSelecionados={handleExcluirSelecionados}
        isPending={isPending}
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Hambúrgueres ativos</h3>
            <p className="mt-0.5 text-[11px] text-zinc-400">Use as setas para escolher a ordem de exibição no cardápio público.</p>
          </div>
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#E16349] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#c8523a]"
          >
            + Novo Produto
          </button>
        </div>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto">
          {produtos.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-400">Nenhum hambúrguer cadastrado no cardápio.</p>
          ) : (
            produtos.map((produto, indice) => (
              <CardProdutoAdmin
                key={produto.id}
                produto={produto}
                isSelecionado={selecionados.includes(produto.id)}
                onToggleSelect={() => handleToggleSelect(produto.id)}
                onAlternarStatus={() => handleAlternarStatusProduto(produto.id, produto.disponivel)}
                onExcluir={() => handleExcluirProduto(produto.id, produto.nome)}
                onEditar={() => setProdutoParaEditar(produto)}
                onMoverParaCima={() => handleMoverProduto(indice, -1)}
                onMoverParaBaixo={() => handleMoverProduto(indice, 1)}
                podeSubir={indice > 0}
                podeDescer={indice < produtos.length - 1}
                isPending={isPending}
              />
            ))
          )}
        </div>
      </div>

      <ModalNovoProduto
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        insumosDisponiveis={insumosDisponiveis}
      />

      <ModalEditarProduto
        produto={produtoParaEditar}
        onFechar={() => setProdutoParaEditar(null)}
        insumosDisponiveis={insumosDisponiveis}
      />
    </section>
  );
}
