'use client';

import { AbaEntregaCheckout } from './tipos';

interface AbasEntregaProps {
  abaAtiva: AbaEntregaCheckout;
  onChangeAba: (aba: AbaEntregaCheckout) => void;
  classeCorTextoAtiva: string;
}

export default function AbasEntrega({
  abaAtiva,
  onChangeAba,
  classeCorTextoAtiva,
}: AbasEntregaProps) {
  return (
    <div className="flex border-b border-[#F3F3F3] bg-[#F8F8F8] p-1 font-bold text-[11px] shrink-0">
      <button
        type="button"
        onClick={() => onChangeAba('CEP')}
        className={`flex-1 text-center py-2.5 rounded-[10px] transition-all ${
          abaAtiva === 'CEP' ? `bg-white shadow-sm ${classeCorTextoAtiva}` : 'text-zinc-400 hover:text-zinc-600'
        }`}
      >
        Entrega via CEP
      </button>
      <button
        type="button"
        onClick={() => onChangeAba('GPS')}
        className={`flex-1 text-center py-2.5 rounded-[10px] transition-all ${
          abaAtiva === 'GPS' ? `bg-white shadow-sm ${classeCorTextoAtiva}` : 'text-zinc-400 hover:text-zinc-600'
        }`}
      >
        Usar GPS
      </button>
      <button
        type="button"
        onClick={() => onChangeAba('RETIRADA')}
        className={`flex-1 text-center py-2.5 rounded-[10px] transition-all ${
          abaAtiva === 'RETIRADA' ? `bg-white shadow-sm ${classeCorTextoAtiva}` : 'text-zinc-400 hover:text-zinc-600'
        }`}
      >
        Retirada
      </button>
    </div>
  );
}
