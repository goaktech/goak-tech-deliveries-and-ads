import { AdminNavHeader } from '@/components/admin/AdminNavHeader';
import { ListaEntregadoresAdmin } from '@/components/admin/ListaEntregadoresAdmin';
import { listarEntregadoresAdmin } from '@/actions/adminEntregadores';

export const revalidate = 0;

export default async function PainelEntregadoresAdmin() {
  const entregadores = await listarEntregadoresAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  return (
    <div className="min-h-screen bg-[#F3F3F3] text-[#1A1A1A] font-sans antialiased flex items-start justify-center p-4 sm:p-8 md:py-12">
      <div className="w-full max-w-4xl space-y-6">
        <AdminNavHeader activeTab="entregadores" />

        <section className="bg-white rounded-[24px] p-6 shadow-sm shadow-zinc-300/40 space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Entregadores</h1>
            <p className="text-sm text-zinc-500">
              Cadastre os motoboys da sua loja. Cada um recebe um link pessoal para ver e capturar pedidos prontos
              para entrega — envie o link por WhatsApp, sem precisar de senha.
            </p>
          </div>

          <ListaEntregadoresAdmin entregadoresIniciais={entregadores} appUrl={appUrl} />
        </section>
      </div>
    </div>
  );
}
