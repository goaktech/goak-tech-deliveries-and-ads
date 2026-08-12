'use client';

import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Insumo } from '@/types/database';

interface EditarProps {
  insumo: Insumo | null;
  onFechar: () => void;
  onSalvar: (id: string, nome: string, custo: number, estoque: number, minimo: number) => void;
  isPending: boolean;
}

export default function ModalEditarInsumo({ insumo, onFechar, onSalvar, isPending }: EditarProps) {
  if (!insumo || typeof document === 'undefined') return null;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nome = String(formData.get('nome') ?? '').trim();
    const custo = Number(formData.get('custo'));
    const estoque = Number(formData.get('estoque'));
    const minimo = Number(formData.get('minimo'));

    if (!nome) return;

    onSalvar(insumo.id, nome, custo, estoque, minimo);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl transform transition-all animate-in fade-in zoom-in-95 duration-150">
        
        <div className="flex items-center justify-between border-b border-zinc-100 p-5">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-[#1A1A1A]">Editar {insumo.nome}</h2>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Atualização de custos</p>
          </div>
          <button type="button" onClick={onFechar} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500 hover:bg-zinc-200">✕</button>
        </div>

        <form key={insumo.id} onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="space-y-1">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Nome do insumo</label>
            <input name="nome" type="text" required defaultValue={insumo.nome} className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#E16349] focus:ring-1 focus:ring-[#E16349]" />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Novo custo unitário (R$ por {insumo.unidade_medida})</label>
            <input name="custo" type="number" step="0.0001" required defaultValue={insumo.custo_unitario} className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#E16349] focus:ring-1 focus:ring-[#E16349]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Estoque atual</label>
              <input name="estoque" type="number" step="0.01" required defaultValue={insumo.estoque_atual} className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#E16349]" />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Alerta mínimo</label>
              <input name="minimo" type="number" step="0.01" required defaultValue={insumo.estoque_minimo} className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#E16349]" />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onFechar} className="flex-1 rounded-xl bg-zinc-100 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-200">Cancelar</button>
            <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-[#E16349] py-2 text-xs font-semibold text-white hover:bg-[#c8523a] disabled:opacity-50">{isPending ? 'Atualizando...' : 'Atualizar insumo'}</button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
}
