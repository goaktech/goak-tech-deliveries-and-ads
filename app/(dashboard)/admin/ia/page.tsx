import { AdminNavHeader } from '@/components/admin/AdminNavHeader';

export default function PainelIaEmBreve() {
  return (
    <div className="min-h-screen bg-[#F3F3F3] text-[#1A1A1A] font-sans antialiased flex items-start justify-center p-4 sm:p-8 md:py-12">
      <div className="w-full max-w-4xl space-y-6">
        <AdminNavHeader activeTab="ia" />
        <section className="rounded-3xl border border-[#E16349]/30 bg-[#FFF4F1] p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">IA</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Novo módulo estratégico em construção.
          </p>
        </section>
      </div>
    </div>
  );
}
