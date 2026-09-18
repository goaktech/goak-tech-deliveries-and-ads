'use client';

import { useMemo } from 'react';
import { encontrarZonaEntrega, type ZonaEntrega } from '@/utils/config-lojas-especiais';

interface SeletorBairroEntregaProps {
  /** Localidades atendidas (com a taxa de cada uma). */
  zonas: ZonaEntrega[];
  /** Nome da localidade escolhida ('' = nenhuma). */
  valor: string;
  onChange: (nome: string) => void;
  /** Bairro que o mapa/GPS devolveu quando ele não bate com nenhuma localidade da lista. */
  bairroDetectado?: string;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function SeletorBairroEntrega({ zonas, valor, onChange, bairroDetectado }: SeletorBairroEntregaProps) {
  const zonasOrdenadas = useMemo(() => [...zonas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [zonas]);
  const zonaSelecionada = useMemo(() => encontrarZonaEntrega({ taxaEntregaFixa: 0, ocultarRetirada: false, zonasEntrega: zonas }, valor), [zonas, valor]);

  return (
    <div className="space-y-1.5">
      <label htmlFor="select-bairro-entrega" className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">
        Bairro
      </label>
      <select
        id="select-bairro-entrega"
        required
        value={zonaSelecionada?.nome ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2.5 text-base sm:text-xs font-medium focus:outline-none focus:bg-white focus:border-zinc-300 transition-all text-zinc-800"
      >
        <option value="">Selecione seu bairro</option>
        {zonasOrdenadas.map((zona) => (
          <option key={zona.nome} value={zona.nome}>
            {zona.nome} — {formatarMoeda(zona.taxa)}
          </option>
        ))}
      </select>

      {zonaSelecionada ? (
        <p className="text-[11px] font-semibold text-zinc-600">
          Taxa de entrega para {zonaSelecionada.nome}: {formatarMoeda(zonaSelecionada.taxa)}
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          {bairroDetectado
            ? `O mapa indicou “${bairroDetectado}”, que não está na nossa lista. Escolha o bairro mais próximo acima. `
            : ''}
          Não encontrou seu bairro? Use a retirada no balcão ou fale com a loja.
        </p>
      )}
    </div>
  );
}
