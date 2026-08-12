import Link from 'next/link';
import { FormAssinatura } from './form-assinatura';

export default function PaginaAssinar() {
  return (
    <main className="min-h-screen bg-[#F8F8F8] px-6 py-10 text-[#1A1A1A] md:px-10">
      <div className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-2">
        <section className="rounded-3xl border border-zinc-200 bg-white p-8">
          <h1 className="text-3xl font-bold tracking-tight">Assine o Gòak Tech Deliveries e Ads</h1>
          <p className="mt-3 text-sm text-zinc-600">
            Finalize sua assinatura e ative automaticamente sua loja com acesso por magic link.
          </p>

          <ul className="mt-6 space-y-3 text-sm text-zinc-700">
            <li>• Checkout seguro via Stripe</li>
            <li>• Provisionamento automático da loja</li>
            <li>• Acesso administrativo por e-mail</li>
          </ul>

          <Link href="/" className="mt-8 inline-block text-sm font-semibold text-[#E16349] hover:underline">
            Voltar para a landing page
          </Link>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-8">
          <h2 className="text-xl font-semibold">Dados iniciais da assinatura</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Esses dados serão usados para criar sua conta após confirmação do pagamento.
          </p>
          <div className="mt-6">
            <FormAssinatura />
          </div>
        </section>
      </div>
    </main>
  );
}
