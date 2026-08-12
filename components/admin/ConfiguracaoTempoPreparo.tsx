'use client';

import { useState } from 'react';
import { atualizarTempoPreparoLoja } from '@/actions/adminConfiguracoesLoja';

interface ConfiguracaoTempoPreparoProps {
  tempoPreparoBaseMinutosInicial: number;
  tempoPreparoIncrementoMinutosInicial: number;
  tempoPreparoTetoMinutosInicial: number;
}

export function ConfiguracaoTempoPreparo({
  tempoPreparoBaseMinutosInicial,
  tempoPreparoIncrementoMinutosInicial,
  tempoPreparoTetoMinutosInicial,
}: ConfiguracaoTempoPreparoProps) {
  const [base, setBase] = useState(String(tempoPreparoBaseMinutosInicial));
  const [incremento, setIncremento] = useState(String(tempoPreparoIncrementoMinutosInicial));
  const [teto, setTeto] = useState(String(tempoPreparoTetoMinutosInicial));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const baseNumero = Number(base);
  const incrementoNumero = Number(incremento);
  const tetoNumero = Number(teto);

  const exemploFila3 = Number.isFinite(baseNumero) && Number.isFinite(incrementoNumero) && Number.isFinite(tetoNumero)
    ? Math.min(baseNumero + incrementoNumero * 3, tetoNumero)
    : null;

  const handleSalvar = async () => {
    setSalvando(true);
    setMensagem(null);

    const resultado = await atualizarTempoPreparoLoja({
      tempoPreparoBaseMinutos: Math.round(baseNumero),
      tempoPreparoIncrementoMinutos: Math.round(incrementoNumero),
      tempoPreparoTetoMinutos: Math.round(tetoNumero),
    });

    setMensagem(
      resultado.success
        ? { tipo: 'success', texto: 'Configuração de tempo de preparo salva com sucesso!' }
        : { tipo: 'error', texto: resultado.error ?? 'Falha ao salvar a configuração.' }
    );
    setSalvando(false);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 space-y-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tempo de preparo</div>
        <p className="mt-1 text-sm text-zinc-500">
          Usado para estimar quanto tempo falta pro pedido chegar. Quanto mais pedidos ativos na cozinha, maior a
          estimativa mostrada ao cliente.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Tempo base (min)
          </label>
          <input
            type="number"
            min={0}
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none"
          />
          <p className="text-[11px] text-zinc-400">Com a cozinha vazia, sem fila.</p>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Acréscimo por pedido na fila (min)
          </label>
          <input
            type="number"
            min={0}
            value={incremento}
            onChange={(e) => setIncremento(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none"
          />
          <p className="text-[11px] text-zinc-400">Somado por cada pedido ativo na cozinha agora.</p>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Teto máximo (min)
          </label>
          <input
            type="number"
            min={0}
            value={teto}
            onChange={(e) => setTeto(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none"
          />
          <p className="text-[11px] text-zinc-400">Nunca estima mais que isso, mesmo com fila grande.</p>
        </div>
      </div>

      {exemploFila3 != null ? (
        <div className="rounded-xl bg-zinc-50 border border-zinc-200/60 px-3.5 py-2.5 text-xs text-zinc-500">
          Exemplo: com <span className="font-semibold text-zinc-700">3 pedidos</span> ativos na fila, a estimativa de
          preparo seria de <span className="font-semibold text-zinc-700">{exemploFila3} min</span>.
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

      <button
        type="button"
        onClick={handleSalvar}
        disabled={salvando}
        className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  );
}
