'use client';

import { AbaEntregaCheckout } from './tipos';

interface CampoCepEntregaProps {
  cep: string;
  onChangeCep: (valor: string) => void;
  abaAtiva: AbaEntregaCheckout;
  /** true enquanto o endereço do CEP está sendo consultado. */
  buscando?: boolean;
  /** resultado da última consulta (endereço encontrado ou motivo da falha). */
  mensagem?: { tipo: 'ok' | 'erro'; texto: string } | null;
}

export default function CampoCepEntrega({ cep, onChangeCep, abaAtiva, buscando = false, mensagem = null }: CampoCepEntregaProps) {
  return (
    <div className="space-y-1">
      <label htmlFor="input-cep" className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">
        Digite seu CEP
      </label>
      <input
        id="input-cep"
        type="text"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={9}
        required={abaAtiva === 'CEP'}
        value={cep}
        onChange={(e) => onChangeCep(e.target.value)}
        placeholder="00000-000"
        className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-zinc-300 transition-all text-zinc-800"
      />
      <div aria-live="polite" className="min-h-[16px]">
        {buscando ? (
          <p className="text-[11px] font-medium text-zinc-500">Buscando endereço…</p>
        ) : mensagem ? (
          <p className={`text-[11px] font-medium ${mensagem.tipo === 'ok' ? 'text-emerald-700' : 'text-amber-700'}`}>
            {mensagem.texto}
          </p>
        ) : null}
      </div>
    </div>
  );
}
