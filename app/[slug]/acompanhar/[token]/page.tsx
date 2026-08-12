import { notFound } from 'next/navigation';
import { PainelAcompanhamentoPedido } from '@/components/ecommerce/acompanhamento/PainelAcompanhamentoPedido';
import { buscarPedidoPublicoPorToken, obterResumoPedidoPublico } from '@/utils/pedidos-acompanhamento';

export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ pagamento?: string }>;
}

export default async function PaginaAcompanhamentoPedido({ params, searchParams }: PageProps) {
  const { slug, token } = await params;
  const { pagamento } = await searchParams;

  const pedido = await buscarPedidoPublicoPorToken(slug, token);
  if (!pedido) {
    notFound();
  }

  return <PainelAcompanhamentoPedido pedidoInicial={obterResumoPedidoPublico(pedido)} pagamento={pagamento} />;
}
