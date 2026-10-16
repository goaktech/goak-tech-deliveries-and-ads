'use client';

import { useEffect, useState } from 'react';

const FORMATO_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

export function FaixaHomologacaoIfood({ clientId }: { clientId: string }) {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const intervalo = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <div className="sticky top-2 z-50 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 font-mono text-[11px] font-semibold text-[#EA1D2C] shadow-sm">
      <span>iFood · homologação · client_id {clientId}</span>
      <span suppressHydrationWarning>{FORMATO_DATA_HORA.format(agora)}</span>
    </div>
  );
}
