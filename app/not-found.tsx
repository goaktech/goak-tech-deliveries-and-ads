import Link from 'next/link';

export default function PaginaNaoEncontrada() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F3F3F3] p-4 text-[#1A1A1A]">
      <section className="w-full max-w-md space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-5xl font-extrabold tracking-tight text-[#E16349]">404</p>
        <h1 className="text-xl font-bold tracking-tight">Página não encontrada</h1>
        <p className="text-sm text-zinc-500">
          O endereço pode ter mudado ou a loja não existe mais. Confira o link e tente de novo.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1A1A1A] px-5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-zinc-800"
        >
          Ir para o início
        </Link>
      </section>
    </main>
  );
}
