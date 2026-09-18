'use client';

import type { ZonaEntrega } from '@/utils/config-lojas-especiais';
import SeletorBairroEntrega from './SeletorBairroEntrega';

interface FormularioEnderecoEntregaProps {
  rua: string;
  onChangeRua: (valor: string) => void;
  numero: string;
  onChangeNumero: (valor: string) => void;
  bairro: string;
  onChangeBairro: (valor: string) => void;
  /** Quando informado, o bairro vira uma lista de localidades atendidas (com taxa por bairro). */
  zonasEntrega?: ZonaEntrega[];
  bairroDetectado?: string;
}

export default function FormularioEnderecoEntrega({
  rua,
  onChangeRua,
  numero,
  onChangeNumero,
  bairro,
  onChangeBairro,
  zonasEntrega,
  bairroDetectado,
}: FormularioEnderecoEntregaProps) {
  return (
    <div className="space-y-3 pt-1 border-t border-[#F3F3F3]">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Rua / Av.</label>
          <input
            type="text"
            required
            value={rua}
            onChange={(e) => onChangeRua(e.target.value)}
            placeholder="Endereço de entrega"
            className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-zinc-300 transition-all placeholder-zinc-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Número</label>
          <input
            id="input-numero"
            type="text"
            required
            value={numero}
            onChange={(e) => onChangeNumero(e.target.value)}
            placeholder="Nº"
            className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-zinc-300 transition-all placeholder-zinc-400"
          />
        </div>
      </div>

      {zonasEntrega && zonasEntrega.length > 0 ? (
        <SeletorBairroEntrega zonas={zonasEntrega} valor={bairro} onChange={onChangeBairro} bairroDetectado={bairroDetectado} />
      ) : (
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Bairro</label>
          <input
            type="text"
            required
            value={bairro}
            onChange={(e) => onChangeBairro(e.target.value)}
            placeholder="Bairro"
            className="w-full bg-[#F3F3F3]/60 border border-transparent rounded-[14px] px-3.5 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:border-zinc-300 transition-all placeholder-zinc-400"
          />
        </div>
      )}
    </div>
  );
}
