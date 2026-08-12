'use client';

import { useState } from 'react';
import { alternarAtivoEntregadorAdmin, criarEntregadorAdmin } from '@/actions/adminEntregadores';
import type { Entregador } from '@/utils/entregadores';

interface ListaEntregadoresAdminProps {
  entregadoresIniciais: Entregador[];
  appUrl: string;
}

export function ListaEntregadoresAdmin({ entregadoresIniciais, appUrl }: ListaEntregadoresAdminProps) {
  const [entregadores, setEntregadores] = useState(entregadoresIniciais);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const montarLink = (token: string) => `${appUrl}/entrega/${token}`;

  const handleCriar = async () => {
    setSalvando(true);
    setMensagem(null);

    const resultado = await criarEntregadorAdmin(nome, telefone);

    if (resultado.success && resultado.entregador) {
      setEntregadores((atual) => [...atual, resultado.entregador!]);
      setNome('');
      setTelefone('');
      setMensagem({ tipo: 'success', texto: 'Entregador cadastrado! Copie o link pessoal abaixo e envie por WhatsApp.' });
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error ?? 'Falha ao cadastrar entregador.' });
    }

    setSalvando(false);
  };

  const handleAlternarAtivo = async (entregadorId: string, ativoAtual: boolean) => {
    setAlternandoId(entregadorId);
    const resultado = await alternarAtivoEntregadorAdmin(entregadorId, !ativoAtual);
    if (resultado.success) {
      setEntregadores((atual) =>
        atual.map((e) => (e.id === entregadorId ? { ...e, ativo: !ativoAtual } : e))
      );
    }
    setAlternandoId(null);
  };

  const handleCopiarLink = async (entregadorId: string, token: string) => {
    try {
      await navigator.clipboard.writeText(montarLink(token));
      setCopiadoId(entregadorId);
      window.setTimeout(() => setCopiadoId(null), 2000);
    } catch (error) {
      console.error('Falha ao copiar link:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 p-5 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Novo entregador</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Carlos Silva"
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Telefone</label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 90000-0000"
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none"
            />
          </div>
        </div>

        {mensagem ? (
          <div
            className={`rounded-xl px-3 py-2 text-xs font-medium ${
              mensagem.tipo === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {mensagem.texto}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleCriar}
          disabled={salvando}
          className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {salvando ? 'Cadastrando...' : 'Cadastrar entregador'}
        </button>
      </div>

      <div className="space-y-3">
        {entregadores.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhum entregador cadastrado ainda.</p>
        ) : (
          entregadores.map((entregador) => (
            <div key={entregador.id} className="rounded-2xl border border-zinc-200 p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">{entregador.nome}</p>
                  <p className="text-xs text-zinc-500">{entregador.telefone}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    entregador.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'
                  }`}
                >
                  {entregador.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopiarLink(entregador.id, entregador.tokenAcesso)}
                  className="rounded-xl border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
                >
                  {copiadoId === entregador.id ? 'Link copiado!' : 'Copiar link pessoal'}
                </button>
                <button
                  type="button"
                  onClick={() => handleAlternarAtivo(entregador.id, entregador.ativo)}
                  disabled={alternandoId === entregador.id}
                  className="rounded-xl border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50"
                >
                  {alternandoId === entregador.id ? 'Aguarde...' : entregador.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
