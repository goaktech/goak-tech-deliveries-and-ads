'use client';

import { useState } from 'react';
import { listarContasMetaAds, selecionarContaMetaAds, type ContaAnunciosOpcao } from '@/actions/adminMetaAds';

interface ConfiguracaoMetaAdsProps {
  /** Situação para exibição: conectado | reconectar | pendente | desconectado. */
  situacao: 'conectado' | 'reconectar' | 'pendente' | 'desconectado';
  diasParaExpirar: number | null;
  contaNome: string | null;
  contaMoeda: string | null;
}

const BADGES: Record<ConfiguracaoMetaAdsProps['situacao'], string> = {
  conectado:
    'rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600',
  reconectar:
    'rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700',
  pendente:
    'rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-600',
  desconectado:
    'rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-600',
};

export function ConfiguracaoMetaAds({ situacao, diasParaExpirar, contaNome, contaMoeda }: ConfiguracaoMetaAdsProps) {
  const [contas, setContas] = useState<ContaAnunciosOpcao[] | null>(null);
  const [contaAtualId, setContaAtualId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const conectado = situacao === 'conectado';
  const precisaReconectar = situacao === 'reconectar';

  const abrirSelecao = async () => {
    setCarregando(true);
    setMensagem(null);
    const resultado = await listarContasMetaAds();
    setCarregando(false);
    if (!resultado.success) {
      setMensagem({ tipo: 'error', texto: resultado.error });
      return;
    }
    setContas(resultado.contas);
    setContaAtualId(resultado.contaAtualId);
  };

  const trocarConta = async (adAccountId: string) => {
    if (adAccountId === contaAtualId) return;
    setSalvando(true);
    setMensagem(null);
    const resultado = await selecionarContaMetaAds(adAccountId);
    setSalvando(false);
    if (!resultado.success) {
      setMensagem({ tipo: 'error', texto: resultado.error });
      return;
    }
    setContaAtualId(adAccountId);
    setMensagem({ tipo: 'success', texto: 'Conta de anúncios atualizada. As métricas já usam a nova conta.' });
    setContas(null);
    window.location.reload();
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Meta Ads</div>
          <div className="text-lg font-semibold text-zinc-900">
            {conectado ? 'Conta conectada' : precisaReconectar ? 'Reconexão necessária' : 'Conta não conectada'}
          </div>
        </div>
        <span className={BADGES[situacao]}>{precisaReconectar ? 'reconectar' : situacao}</span>
      </div>

      <div className="text-sm text-zinc-600">
        {contaNome
          ? `Conta de anúncios vinculada: ${contaNome}${contaMoeda ? ` (${contaMoeda})` : ''}`
          : 'Nenhuma conta de anúncios vinculada ainda.'}
      </div>

      {precisaReconectar ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          A autorização com a Meta expirou ou foi revogada. Clique em &quot;Reconectar Meta Ads&quot; para voltar a ver as
          métricas.
        </div>
      ) : null}

      {conectado && diasParaExpirar !== null ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          A autorização com a Meta expira em {diasParaExpirar} {diasParaExpirar === 1 ? 'dia' : 'dias'}. Reconecte antes
          disso para não perder as métricas.
        </div>
      ) : null}

      {mensagem ? (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            mensagem.tipo === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      {contas ? (
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Escolher conta</label>
          <select
            value={contaAtualId ?? ''}
            disabled={salvando}
            onChange={(e) => void trocarConta(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 min-h-11 px-3.5 py-2.5 text-base sm:text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none"
          >
            {contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.nome}
                {conta.moeda ? ` (${conta.moeda})` : ''}
                {conta.ativa ? '' : ' — inativa'}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <form action="/api/admin/integracoes/meta-ads/conectar" method="get">
          <button
            type="submit"
            className="rounded-xl bg-zinc-900 min-h-11 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white"
          >
            {precisaReconectar || conectado ? 'Reconectar Meta Ads' : 'Conectar Meta Ads'}
          </button>
        </form>

        {conectado && !contas ? (
          <button
            type="button"
            onClick={abrirSelecao}
            disabled={carregando}
            className="rounded-xl border border-zinc-200 bg-white min-h-11 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-zinc-700 disabled:opacity-50"
          >
            {carregando ? 'Carregando...' : 'Trocar conta de anúncios'}
          </button>
        ) : null}

        <form action="/api/admin/integracoes/meta-ads/desconectar" method="post">
          <button
            type="submit"
            className="rounded-xl border border-zinc-200 bg-white min-h-11 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-zinc-700"
          >
            Desconectar
          </button>
        </form>
      </div>
    </div>
  );
}
