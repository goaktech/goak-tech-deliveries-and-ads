import { listarProdutosComCMV } from '@/actions/admin';
import { listarInsumosAdmin } from '@/actions/adminInsumos';
import ListaProdutosAdmin from '@/components/ListaProdutosAdmin';

export const revalidate = 0; 

export default async function PainelProdutosAdmin() {
  const [produtos, insumos] = await Promise.all([listarProdutosComCMV(), listarInsumosAdmin()]);

  return (
    <>
        
        <ListaProdutosAdmin produtosIniciais={produtos} insumosDisponiveis={insumos} />

    </>
  );
}
