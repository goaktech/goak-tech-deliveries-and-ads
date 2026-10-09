'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErroDaPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F3F3F3] p-4 text-[#1A1A1A]">
      <section role="alert" className="w-full max-w-md space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">Algo deu errado</h1>
        <p className="text-sm text-zinc-500">
          Não foi possível carregar esta página. Seus dados não foram perdidos. Tente de novo em instantes.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#E16349] px-5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#c8523a]"
          >
            Tentar de novo
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 text-xs font-bold uppercase tracking-wider text-zinc-700 transition hover:border-zinc-300"
          >
            Ir para o início
          </Link>
        </div>
        {error.digest ? <p className="text-[11px] text-zinc-400">Código: {error.digest}</p> : null}
      </section>
    </main>
  );
}
