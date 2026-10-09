import { listarInsumosAdmin } from '@/actions/adminInsumos';
import ListaInsumosAdmin from '@/components/ListaInsumosAdmin';

export const revalidate = 0;

export default async function PainelInsumosAdmin() {
  const insumos = await listarInsumosAdmin();

  return (
    <>
        
        <ListaInsumosAdmin insumosIniciais={insumos} />

    </>
  );
}
