'use client';

import { useState } from 'react';
import { atualizarHorarioFuncionamentoLoja } from '@/actions/adminConfiguracoesLoja';
import {
  HORARIOS_PADRAO_FORM,
  NOMES_DIAS_SEMANA,
  type HorarioFuncionamentoDia,
} from '@/utils/horario-funcionamento';

interface ConfiguracaoHorarioFuncionamentoProps {
  horariosIniciais: HorarioFuncionamentoDia[] | null;
}

export function ConfiguracaoHorarioFuncionamento({ horariosIniciais }: ConfiguracaoHorarioFuncionamentoProps) {
  const [horarios, setHorarios] = useState<HorarioFuncionamentoDia[]>(horariosIniciais ?? HORARIOS_PADRAO_FORM);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const atualizarDia = (dia: number, alteracoes: Partial<HorarioFuncionamentoDia>) => {
    setHorarios((atual) => atual.map((h) => (h.dia === dia ? { ...h, ...alteracoes } : h)));
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setMensagem(null);

    const resultado = await atualizarHorarioFuncionamentoLoja(horarios);

    setMensagem(
      resultado.success
        ? { tipo: 'success', texto: 'Horário de funcionamento salvo com sucesso!' }
        : { tipo: 'error', texto: resultado.error ?? 'Falha ao salvar o horário de funcionamento.' }
    );
    setSalvando(false);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 space-y-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Horário de funcionamento</div>
        <p className="mt-1 text-sm text-zinc-500">
          Fora desse horário, a vitrine mostra uma mensagem de &quot;loja fechada&quot; no lugar do cardápio. Deixe um
          dia desmarcado para ficar fechado o dia inteiro.
        </p>
      </div>

      <div className="space-y-2">
        {horarios.map((horario) => (
          <div key={horario.dia} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-100 p-3">
            <label className="flex w-40 shrink-0 items-center gap-2 text-sm font-medium text-zinc-800">
              <input
                type="checkbox"
                checked={horario.ativo}
                onChange={(e) => atualizarDia(horario.dia, { ativo: e.target.checked })}
                className="h-4 w-4 cursor-pointer rounded border-zinc-300 text-[#E16349] accent-[#E16349]"
              />
              {NOMES_DIAS_SEMANA[horario.dia]}
            </label>
            <input
              type="time"
              value={horario.abertura}
              disabled={!horario.ativo}
              onChange={(e) => atualizarDia(horario.dia, { abertura: e.target.value })}
              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-900 disabled:opacity-40"
            />
            <span className="text-xs text-zinc-400">até</span>
            <input
              type="time"
              value={horario.fechamento}
              disabled={!horario.ativo}
              onChange={(e) => atualizarDia(horario.dia, { fechamento: e.target.value })}
              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-900 disabled:opacity-40"
            />
          </div>
        ))}
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
        onClick={handleSalvar}
        disabled={salvando}
        className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando...' : 'Salvar horário'}
      </button>
    </div>
  );
}
