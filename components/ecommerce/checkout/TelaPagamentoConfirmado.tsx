'use client';

import Link from 'next/link';

interface PropsTelaPagamentoConfirmado {
  valor: number;
  numeroPedido?: string | null;
  urlAcompanhamento: string;
}

export default function TelaPagamentoConfirmado({ valor, numeroPedido, urlAcompanhamento }: PropsTelaPagamentoConfirmado) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="titulo-pagamento-confirmado"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-emerald-600 px-6 text-center text-white animate-in fade-in duration-300"
    >
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20 animate-in zoom-in duration-500">
        <svg className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <h2 id="titulo-pagamento-confirmado" className="text-2xl font-extrabold tracking-tight">
        Pagamento confirmado!
      </h2>
      <p className="max-w-xs text-sm text-emerald-50">
        Recebemos {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        {numeroPedido ? ` do pedido #${numeroPedido}` : ''}. A cozinha já foi avisada.
      </p>
      <Link
        href={urlAcompanhamento}
        className="mt-2 flex min-h-12 w-full max-w-xs items-center justify-center rounded-xl bg-white px-4 text-xs font-extrabold uppercase tracking-wider text-emerald-700"
      >
        Acompanhar meu pedido
      </Link>
      <p className="text-[11px] text-emerald-100">Levando você ao acompanhamento…</p>
    </div>
  );
}
