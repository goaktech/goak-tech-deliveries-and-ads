'use client';

import { useState } from 'react';

interface ModalProps {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (nome: string, unidade: 'g' | 'ml' | 'un', custo: number, estoqueAtual: number, estoqueMinimo: number) => void;
  isPending: boolean;
}

type UnidadeMedida = 'g' | 'ml' | 'un';

export default function ModalNovoInsumo({ aberto, onFechar, onSalvar, isPending }: ModalProps) {
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState<UnidadeMedida>('un');
  const [custo, setCusto] = useState('');
  const [estoqueAtual, setEstoqueAtual] = useState('');
  const [estoqueMinimo, setEstoqueMinimo] = useState('');

  const handleUnidadeChange = (value: string) => {
    if (value === 'g' || value === 'ml' || value === 'un') {
      setUnidade(value);
    }
  };

  if (!aberto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !custo) return;
    onSalvar(
      nome, 
      unidade, 
      parseFloat(custo), 
      estoqueAtual ? parseFloat(estoqueAtual) : 0, 
      estoqueMinimo ? parseFloat(estoqueMinimo) : 0
    );
    setNome(''); setCusto(''); setEstoqueAtual(''); setEstoqueMinimo('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 p-4 backdrop-blur-sm transition-all duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 p-5">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-[#1A1A1A]">Nova matéria-prima</h2>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Gestão de custos</p>
          </div>
          <button type="button" onClick={onFechar} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500 transition hover:bg-zinc-200">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="space-y-1">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Nome do insumo</label>
            <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Queijo Cheddar Fatiado" className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#E16349] focus:ring-1 focus:ring-[#E16349] placeholder-zinc-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Unidade de medida</label>
              <select value={unidade} onChange={(e) => handleUnidadeChange(e.target.value)} className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#E16349] focus:ring-1 focus:ring-[#E16349] cursor-pointer">
                <option value="un">Unidade (un)</option>
                <option value="g">Grama (g)</option>
                <option value="ml">Mililitro (ml)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Custo unitário (R$)</label>
              <input type="number" step="0.0001" required value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#E16349] focus:ring-1 focus:ring-[#E16349] placeholder-zinc-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Estoque inicial</label>
              <input type="number" step="0.01" value={estoqueAtual} onChange={(e) => setEstoqueAtual(e.target.value)} placeholder="0" className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#E16349] focus:ring-1 focus:ring-[#E16349] placeholder-zinc-400" />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Alerta mínimo</label>
              <input type="number" step="0.01" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} placeholder="0" className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#E16349] focus:ring-1 focus:ring-[#E16349] placeholder-zinc-400" />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onFechar} className="flex-1 rounded-xl bg-zinc-100 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-200">Cancelar</button>
            <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-[#E16349] py-2 text-xs font-semibold text-white hover:bg-[#c8523a] disabled:opacity-50">{isPending ? 'Salvando...' : 'Salvar insumo'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
