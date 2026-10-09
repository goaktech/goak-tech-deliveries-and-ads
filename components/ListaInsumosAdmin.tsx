'use client';

import { useState, useTransition } from 'react';
import { Insumo } from '@/types/database';
import { criarInsumoAdmin, excluirInsumosEmLote, atualizarCustoInsumoAdmin } from '@/actions/adminInsumos';
import { useRouter } from 'next/navigation';
import CardInsumoAdmin from './insumos-admin/CardInsumoAdmin';
import ModalNovoInsumo from './insumos-admin/ModalNovoInsumo';
import ModalEditarInsumo from './insumos-admin/ModalEditarInsumo';
import { estilosPainel } from '@/components/shared/estilosPainel';
import { useAvisosPainel } from '@/components/shared/AvisosPainel';

interface ListaProps {
  insumosIniciais: Insumo[];
}

export default function ListaInsumosAdmin({ insumosIniciais }: ListaProps) {
  const router = useRouter();
  const { confirmar, avisar } = useAvisosPainel();
  const [isPending, startTransition] = useTransition();
  const [selecionados, setSelecionados] = useState<string[]>([]);
  
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [insumoParaEditar, setInsumoParaEditar] = useState<Insumo | null>(null);

  const handleToggleSelect = (id: string) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    setSelecionados(selecionados.length === insumosIniciais.length ? [] : insumosIniciais.map(i => i.id));
  };

  const handleExcluirLote = async () => {
    if (selecionados.length === 0) return;
    const confirmado = await confirmar({
      titulo: `Excluir ${selecionados.length} ${selecionados.length === 1 ? 'insumo' : 'insumos'}?`,
      mensagem: 'Isso afetará o cálculo do CMV das fichas técnicas.',
      rotuloConfirmar: 'Excluir',
      perigo: true,
    });
    if (!confirmado) return;

    startTransition(async () => {
      const resultado = await excluirInsumosEmLote(selecionados);
      if (resultado.success) {
        setSelecionados([]); router.refresh();
        return;
      }
      avisar('Não foi possível excluir os insumos. Tente de novo.', 'erro');
    });
  };

  const handleExcluirInsumo = async (insumo: Insumo) => {
    const confirmado = await confirmar({
      titulo: `Apagar "${insumo.nome}"?`,
      mensagem: 'Isso afetará o cálculo do CMV das fichas técnicas que usam este insumo.',
      rotuloConfirmar: 'Apagar',
      perigo: true,
    });
    if (!confirmado) return;

    startTransition(async () => {
      const resultado = await excluirInsumosEmLote([insumo.id]);
      if (resultado.success) {
        setSelecionados((prev) => prev.filter((id) => id !== insumo.id));
        router.refresh();
        return;
      }
      avisar('Não foi possível apagar o insumo. Tente de novo.', 'erro');
    });
  };

  const handleSalvarNovoInsumo = (nome: string, unidade: 'g' | 'ml' | 'un', custo: number, atual: number, minimo: number) => {
    startTransition(async () => {
      if ((await criarInsumoAdmin(nome, unidade, custo, atual, minimo)).success) {
        setModalNovoAberto(false); router.refresh();
      }
    });
  };

  const handleAtualizarInsumo = (id: string, nome: string, custo: number, estoque: number, minimo: number) => {
    startTransition(async () => {
      if ((await atualizarCustoInsumoAdmin(id, nome, custo, estoque, minimo)).success) {
        setInsumoParaEditar(null); router.refresh();
      }
    });
  };

  const todosSelecionados = insumosIniciais.length > 0 && selecionados.length === insumosIniciais.length;

  return (
    <main className="relative flex w-full flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-[#1A1A1A]">Matérias-primas e custos</h1>
          <p className="mt-0.5 text-xs font-medium text-zinc-500">Gerenciamento de estoque e valores de compra dos fornecedores</p>
        </div>
        <button type="button" onClick={() => setModalNovoAberto(true)} className={estilosPainel.botaoPrimario}>+ Novo Insumo</button>
      </div>

      <div className="flex flex-col gap-3 border-b border-zinc-100 bg-[#F8F8F8]/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={todosSelecionados} onChange={handleSelectAll} className="w-4 h-4 rounded-md border-zinc-300 text-[#E16349] cursor-pointer accent-[#E16349]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">{selecionados.length > 0 ? `${selecionados.length} selecionados` : 'Selecionar Todos'}</span>
        </div>
        <button onClick={handleExcluirLote} disabled={selecionados.length === 0 || isPending} className={`rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 transition-all ${selecionados.length > 0 ? 'opacity-100' : 'pointer-events-none opacity-40'}`}>Excluir Selecionados</button>
      </div>

      <div className="space-y-3 p-4 sm:p-6">
        {insumosIniciais.length === 0 ? (
          <div className="py-20 text-center text-zinc-400"><p className="text-sm font-semibold">Nenhum insumo no estoque.</p></div>
        ) : (
          insumosIniciais.map(insumo => (
            <CardInsumoAdmin 
              key={insumo.id} 
              insumo={insumo} 
              isSelecionado={selecionados.includes(insumo.id)} 
              onToggleSelect={() => handleToggleSelect(insumo.id)} 
              onEditarClick={(ins) => setInsumoParaEditar(ins)}
              onExcluirClick={handleExcluirInsumo}
              isPending={isPending}
            />
          ))
        )}
      </div>

      <ModalNovoInsumo aberto={modalNovoAberto} onFechar={() => setModalNovoAberto(false)} onSalvar={handleSalvarNovoInsumo} isPending={isPending} />

      <ModalEditarInsumo insumo={insumoParaEditar} onFechar={() => setInsumoParaEditar(null)} onSalvar={handleAtualizarInsumo} isPending={isPending} />
    </main>
  );
}
