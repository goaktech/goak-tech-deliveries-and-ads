'use client';

interface CartaoRetiradaProps {
  endereco: string;
  latitude?: number | null;
  longitude?: number | null;
}

export default function CartaoRetirada({ endereco, latitude, longitude }: CartaoRetiradaProps) {
  const urlMapas =
    typeof latitude === 'number' && typeof longitude === 'number'
      ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;

  return (
    <div className="bg-[#F8F8F8] border border-zinc-100 rounded-[18px] p-4 space-y-3">
      <div>
        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Endereço da Loja</span>
        <p className="text-xs font-bold text-zinc-800 mt-1 leading-relaxed">{endereco}</p>
      </div>
      <a
        href={urlMapas}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-600 hover:text-zinc-900 transition-colors"
      >
        Ver Rota no Google Maps
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}
