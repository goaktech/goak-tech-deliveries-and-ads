'use client';

import React from 'react';
import Image from 'next/image';
import { Insumo } from '@/types/database';
import { AdicionalCustomizado } from '@/actions/admin';

interface AbaDadosProps {
  nome: string;
  setNome: (v: string) => void;
  descricao: string;
  setDescricao: (v: string) => void;
  preco: string;
  setPreco: (v: string) => void;
  fotoPreviewUrl: string;
  nomeArquivoFoto: string;
  onSelecionarFoto: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function AbaDadosBasicos({
  nome,
  setNome,
  descricao,
  setDescricao,
  preco,
  setPreco,
  fotoPreviewUrl,
  nomeArquivoFoto,
  onSelecionarFoto
}: AbaDadosProps) {
  return (
    <div className="space-y-4 flex-1">
      <div className="space-y-1">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Nome do hambúrguer</label>
        <input 
          type="text" 
          required 
          value={nome} 
          onChange={(e) => setNome(e.target.value)} 
          placeholder="Ex: Cheddar Bacon Supremo" 
          className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#E16349]" 
        />
      </div>
      <div className="space-y-1">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Descrição do cardápio</label>
        <textarea 
          value={descricao} 
          onChange={(e) => setDescricao(e.target.value)} 
          placeholder="Ex: Blend artesanal de 150g, muito cheddar derretido..." 
          rows={3} 
          className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#E16349] resize-none" 
        />
      </div>
      <div className="space-y-1">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Preço de venda (R$)</label>
        <input 
          type="number" 
          step="0.01" 
          required 
          value={preco} 
          onChange={(e) => setPreco(e.target.value)} 
          placeholder="0,00" 
          className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-[#E16349]" 
        />
      </div>
      <div className="space-y-2">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Foto do produto</label>
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="foto-produto-input"
            className="inline-flex cursor-pointer items-center rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-900"
          >
            Escolher arquivo
          </label>
          <span className="text-[11px] font-medium text-zinc-500">
            {nomeArquivoFoto || 'Nenhum arquivo selecionado'}
          </span>
        </div>
        <input
          id="foto-produto-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onSelecionarFoto}
          className="hidden"
        />
        {fotoPreviewUrl && (
          <div className="w-24 h-24 overflow-hidden rounded-xl border border-zinc-200/60">
            <Image
              src={fotoPreviewUrl}
              alt="Prévia da foto do produto"
              className="w-full h-full object-cover"
              width={96}
              height={96}
              unoptimized
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface AbaFichaProps {
  insumosDisponiveis: Insumo[];
  quantidadesFicha: Record<string, string>;
  onFichaChange: (id: string, valor: string) => void;
}

export function AbaFichaTecnica({ insumosDisponiveis, quantidadesFicha, onFichaChange }: AbaFichaProps) {
  return (
    <div className="space-y-2 flex-1">
      <p className="mb-2 text-[11px] font-medium text-zinc-500">Gasto físico de matéria-prima para cálculo automático de CMV.</p>
      <div className="bg-[#F8F8F8] rounded-[20px] border border-zinc-100 p-3 space-y-1.5 max-h-64 overflow-y-auto">
        {insumosDisponiveis.map((insumo) => (
          <div key={insumo.id} className="flex items-center justify-between p-2 rounded-xl bg-white border border-transparent hover:border-zinc-200/50 transition-all gap-4">
            <div className="min-w-0">
              <span className="text-xs font-bold text-zinc-800 block truncate">{insumo.nome}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input 
                type="number" 
                step="0.0001" 
                placeholder="0" 
                value={quantidadesFicha[insumo.id] || ''} 
                onChange={(e) => onFichaChange(insumo.id, e.target.value)} 
                className="w-20 text-center bg-[#F3F3F3] border border-transparent rounded-lg py-1 text-xs font-semibold focus:outline-none focus:bg-white focus:border-[#E16349]" 
              />
              <span className="text-[10px] text-zinc-400 font-bold uppercase w-6">{insumo.unidade_medida}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AbaAdicionaisProps {
  adicionais: AdicionalCustomizado[];
  novoNome: string;
  setNovoNome: (v: string) => void;
  novoPreco: string;
  setNovoPreco: (v: string) => void;
  onAdicionar: () => void;
  onRemover: (idx: number) => void;
}

export function AbaAdicionaisOpcionais({ adicionais, novoNome, setNovoNome, novoPreco, setNovoPreco, onAdicionar, onRemover }: AbaAdicionaisProps) {
  return (
    <div className="space-y-4 flex-1">
      <p className="text-[11px] font-medium text-zinc-500">Cadastre os adicionais que o cliente final poderá escolher no cardápio.</p>
      <div className="flex gap-2 items-center bg-[#F8F8F8] p-2 rounded-2xl border border-zinc-100">
        <input 
          type="text" 
          value={novoNome} 
          onChange={(e) => setNovoNome(e.target.value)} 
          placeholder="Ex: Carne Adicional 150g" 
          className="flex-1 bg-white border border-zinc-200/60 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-[#E16349]" 
        />
        <input 
          type="number" 
          step="0.01" 
          value={novoPreco} 
          onChange={(e) => setNovoPreco(e.target.value)} 
          placeholder="R$ 0,00" 
          className="w-24 bg-white border border-zinc-200/60 rounded-xl px-2 py-1.5 text-xs text-center font-semibold focus:outline-none focus:border-[#E16349]" 
        />
        <button type="button" onClick={onAdicionar} className="bg-zinc-900 text-white font-bold text-xs px-3 py-2 rounded-xl hover:bg-zinc-800 transition-colors shrink-0">
          Adicionar
        </button>
      </div>
      <div className="space-y-1.5 max-h-44 overflow-y-auto">
        {adicionais.length === 0 ? (
          <p className="text-center text-xs text-zinc-400 italic py-4">Nenhum adicional inserido ainda.</p>
        ) : (
          adicionais.map((adi, idx) => (
            <div key={idx} className="flex items-center justify-between px-3 py-2 bg-[#F3F3F3]/50 rounded-xl border border-transparent text-xs font-medium">
              <span className="text-zinc-800 font-semibold">{adi.nome}</span>
              <div className="flex items-center gap-3">
                <span className="text-[#E52521] font-bold">+ R$ {adi.preco.toFixed(2)}</span>
                <button type="button" onClick={() => onRemover(idx)} className="text-zinc-400 hover:text-red-600 font-bold px-1 transition-colors">✕</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
