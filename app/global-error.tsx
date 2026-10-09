'use client';

import './globals.css';

/** Último recurso: só aparece se o próprio layout raiz falhar, por isso traz o seu html/body. */
export default function ErroGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#F3F3F3] font-sans antialiased">
        <main className="flex min-h-screen items-center justify-center p-4 text-[#1A1A1A]">
          <section role="alert" className="w-full max-w-md space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-xl font-bold tracking-tight">Algo deu errado</h1>
            <p className="text-sm text-zinc-500">Não foi possível carregar o aplicativo. Tente de novo em instantes.</p>
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#E16349] px-5 text-xs font-bold uppercase tracking-wider text-white"
            >
              Tentar de novo
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
