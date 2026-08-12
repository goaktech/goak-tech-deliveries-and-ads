import { notFound } from 'next/navigation';
import { PainelEntregador } from '@/components/entregadores/PainelEntregador';
import {
  buscarEntregadorPorToken,
  listarPedidosAtivosDoEntregador,
  listarPedidosDisponiveisParaCaptura,
} from '@/utils/entregadores';

export const revalidate = 0;

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PaginaEntregador({ params }: PageProps) {
  const { token } = await params;
  const entregador = await buscarEntregadorPorToken(token);

  if (!entregador || !entregador.ativo) {
    notFound();
  }

  const [disponiveis, ativos] = await Promise.all([
    listarPedidosDisponiveisParaCaptura(entregador.restauranteId),
    listarPedidosAtivosDoEntregador(entregador.id),
  ]);

  return (
    <PainelEntregador
      token={token}
      nomeEntregador={entregador.nome}
      disponiveisIniciais={disponiveis}
      ativosIniciais={ativos}
    />
  );
}
