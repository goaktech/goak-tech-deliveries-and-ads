'use client';

import { AbaEntregaCheckout } from './tipos';

interface CampoCepEntregaProps {
  cep: string;
  onChangeCep: (valor: string) => void;
  abaAtiva: AbaEntregaCheckout;
}

export default function CampoCepEntrega({ cep, onChangeCep, abaAtiva }: CampoCepEntregaProps) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Digite seu CEP</label>
      <input
        type="text"
        maxLength={9}
        required={abaAtiva === 'CEP'}
        value={cep}
        onChange={(e) => onChangeCep(e.target.value)}
        placeholder="00000-000"
        className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-zinc-300 transition-all text-zinc-800"
      />
    </div>
  );
}
