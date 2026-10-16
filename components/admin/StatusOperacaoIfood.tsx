'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EstadoOperacaoIfood, StatusOperacaoIfood as OperacaoIfood } from '@/utils/ifood';

const INTERVALO_ATUALIZACAO_MS = 30000;

const ROTULO_ESTADO: Record<EstadoOperacaoIfood, string> = {
  OK: 'Aberta',
  WARNING: 'Aberta com alerta',
  CLOSED: 'Fechada',
  ERROR: 'Com problema',
};

const CLASSE_ESTADO: Record<EstadoOperacaoIfood, string> = {
  OK: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
  CLOSED: 'border-zinc-200 bg-zinc-100 text-zinc-600',
  ERROR: 'border-red-100 bg-red-50 text-red-700',
};

const ROTULO_OPERACAO: Record<string, string> = {
  delivery: 'Entrega',
  takeout: 'Retirada',
  indoor: 'Consumo no local',
};

interface RespostaStatus {
  conectado?: boolean;
  operacoes?: OperacaoIfood[];
  consultadoEm?: string;
  error?: string;
}

export function StatusOperacaoIfood({ compacto = false }: { compacto?: boolean }) {
  const [dados, setDados] = useState<RespostaStatus | null>(null);

  const consultar = useCallback(async () => {
    try {
      const resposta = await fetch('/api/admin/ifood/status', { cache: 'no-store' });
      setDados((await resposta.json()) as RespostaStatus);
    } catch {
      setDados({ conectado: true, operacoes: [], error: 'Sem conexão para consultar o status no iFood.' });
    }
  }, []);

  useEffect(() => {
    const primeira = setTimeout(() => void consultar(), 0);
    const intervalo = setInterval(() => void consultar(), INTERVALO_ATUALIZACAO_MS);
    return () => {
      clearTimeout(primeira);
      clearInterval(intervalo);
    };
  }, [consultar]);

  if (!dados || dados.conectado === false) {
    return null;
  }

  const operacoes = dados.operacoes ?? [];
  const hora = dados.consultadoEm
    ? new Date(dados.consultadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  if (compacto) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-[11px] font-semibold text-zinc-600">
        <span className="font-bold uppercase tracking-wider text-[#EA1D2C]">Loja no iFood</span>
        {dados.error ? <span className="text-red-600">{dados.error}</span> : null}
        {!dados.error && operacoes.length === 0 ? <span>Sem operações informadas pelo iFood.</span> : null}
        {operacoes.map((operacao) => (
          <span
            key={`${operacao.operacao}-${operacao.canal}`}
            title={[operacao.titulo, operacao.descricao, ...operacao.pendencias.map((p) => p.titulo)].filter(Boolean).join(' · ')}
            className={`rounded-full border px-2.5 py-0.5 ${CLASSE_ESTADO[operacao.estado]}`}
          >
            {ROTULO_OPERACAO[operacao.operacao] ?? operacao.operacao}: {operacao.titulo ?? ROTULO_ESTADO[operacao.estado]}
          </span>
        ))}
        {hora ? <span className="ml-auto font-mono text-zinc-400">consultado às {hora}</span> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <b className="text-zinc-900">Status de operação no iFood</b>
        <button
          type="button"
          onClick={() => void consultar()}
          className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900"
        >
          Atualizar
        </button>
      </div>
      {dados.error ? <div className="text-xs text-red-600">{dados.error}</div> : null}
      {!dados.error && operacoes.length === 0 ? (
        <div className="text-xs text-zinc-500">O iFood não informou operações para esta loja.</div>
      ) : null}
      {operacoes.map((operacao) => (
        <div key={`${operacao.operacao}-${operacao.canal}`} className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${CLASSE_ESTADO[operacao.estado]}`}>
              {ROTULO_ESTADO[operacao.estado]}
            </span>
            <span className="text-zinc-900">
              {ROTULO_OPERACAO[operacao.operacao] ?? operacao.operacao}
              {operacao.canal ? <span className="text-xs text-zinc-400"> · {operacao.canal}</span> : null}
            </span>
          </div>
          {operacao.titulo || operacao.descricao ? (
            <div className="text-xs text-zinc-500">{[operacao.titulo, operacao.descricao].filter(Boolean).join(' — ')}</div>
          ) : null}
          {operacao.pendencias.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-zinc-600">
              {operacao.pendencias.map((pendencia) => (
                <li key={pendencia.codigo}>
                  {[pendencia.titulo ?? pendencia.codigo, pendencia.descricao].filter(Boolean).join(' — ')}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      {hora ? <div className="text-xs text-zinc-400">Consultado às {hora} · atualiza a cada 30 s</div> : null}
    </div>
  );
}
