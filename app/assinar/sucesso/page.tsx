import Link from 'next/link';

export default function PaginaSucessoAssinatura() {
  return (
    <main className="min-h-screen bg-[#F8F8F8] px-6 py-16 text-[#1A1A1A] md:px-10">
      <section className="mx-auto w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-10 text-center">
        <h1 className="text-3xl font-bold">Pagamento confirmado ✅</h1>
        <p className="mt-4 text-sm text-zinc-600">
          Estamos concluindo o provisionamento da sua loja. Em instantes, você receberá um e-mail com o magic link de acesso.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="rounded-2xl bg-[#E16349] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#cf553d]"
          >
            Ir para login
          </Link>
          <Link
            href="/"
            className="rounded-2xl border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Voltar ao site
          </Link>
        </div>
      </section>
    </main>
  );
}
