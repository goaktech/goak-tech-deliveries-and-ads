import { listarProdutosComCMV } from '@/actions/admin';
import { listarInsumosAdmin } from '@/actions/adminInsumos';
import ListaProdutosAdmin from '@/components/ListaProdutosAdmin';
import { AdminNavHeader } from '@/components/admin/AdminNavHeader';

export const revalidate = 0; 

export default async function PainelProdutosAdmin() {
  const produtos = await listarProdutosComCMV();
  const insumos = await listarInsumosAdmin();

  return (
    <div className="min-h-screen bg-[#F3F3F3] text-[#1A1A1A] font-sans antialiased flex items-start justify-center p-4 sm:p-8 md:py-12">
      <div className="w-full max-w-4xl space-y-6">
        
        <AdminNavHeader activeTab="produtos" />

        <ListaProdutosAdmin produtosIniciais={produtos} insumosDisponiveis={insumos} />

      </div>
    </div>
  );
}
