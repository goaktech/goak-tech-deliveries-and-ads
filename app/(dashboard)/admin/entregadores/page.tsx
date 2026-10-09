import { ListaEntregadoresAdmin } from '@/components/admin/ListaEntregadoresAdmin';
import { listarEntregadoresAdmin } from '@/actions/adminEntregadores';

export const revalidate = 0;

export default async function PainelEntregadoresAdmin() {
  const entregadores = await listarEntregadoresAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  return (
    <>
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
    </>
  );
}
