import Link from 'next/link';
import { APP_BRAND_NAME } from '@/utils/branding';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#F8F8F8] text-[#1A1A1A]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 md:px-10 md:py-24">
        <div className="space-y-5">
          <span className="inline-block rounded-full border border-[#E16349]/20 bg-[#E16349]/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-[#E16349]">
            Plataforma SaaS para restaurantes
          </span>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
            Venda mais no seu delivery com o <span className="text-[#E16349]">{APP_BRAND_NAME}</span>.
          </h1>
          <p className="max-w-2xl text-base text-zinc-600 md:text-lg">
            Cardápio digital, checkout próprio, gestão de estoque e métricas operacionais em um único lugar.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl border border-zinc-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Checkout próprio</h2>
            <p className="mt-2 text-sm text-zinc-600">Receba pedidos da sua loja sem depender de marketplace.</p>
          </article>
          <article className="rounded-3xl border border-zinc-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Gestão inteligente</h2>
            <p className="mt-2 text-sm text-zinc-600">Monitore CMV, estoque e funil com dados em tempo real.</p>
          </article>
          <article className="rounded-3xl border border-zinc-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Implantação rápida</h2>
            <p className="mt-2 text-sm text-zinc-600">Assine e ative sua loja com onboarding automático.</p>
          </article>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/assinar"
            className="rounded-2xl bg-[#E16349] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#cf553d]"
          >
            Assinar agora
          </Link>
          <Link
            href="/login"
            className="rounded-2xl border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Já sou cliente
          </Link>
        </div>
      </section>
    </main>
  );
}
