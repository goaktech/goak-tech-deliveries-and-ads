import { AdminNavHeader } from '@/components/admin/AdminNavHeader';

export default function PainelEstoqueEmBreve() {
  return (
    <div className="min-h-screen bg-[#F3F3F3] text-[#1A1A1A] font-sans antialiased flex items-start justify-center p-4 sm:p-8 md:py-12">
      <div className="w-full max-w-4xl space-y-6">
        <AdminNavHeader activeTab="estoque" />
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Estoque (em breve)</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Estamos preparando o módulo de estoque avançado.
          </p>
        </section>
      </div>
    </div>
  );
}
