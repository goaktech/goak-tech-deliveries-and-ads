import { ListaEstornosAdmin, type PagamentoEstornavel, type EstornoHistorico } from '@/components/admin/ListaEstornosAdmin';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

export const revalidate = 0;

type PedidoRelacionado = {
  numero_pedido: number | null;
  status: string;
  forma_pagamento: string;
  valor_total: number;
  dados_cliente: { nome?: string; telefone?: string } | null;
  created_at: string;
};

export default async function PainelEstornosAdmin() {
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = createWebhookAdminClient();

  const [{ data: pagamentos }, { data: estornos }] = await Promise.all([
    supabase
      .from('pagamentos_pedido')
      .select(
        'id, pedido_id, mercado_pago_payment_id, status, metodo, valor, valor_estornado, duplicado, created_at, pedidos ( id, numero_pedido, status, forma_pagamento, valor_total, dados_cliente, created_at )'
      )
      .eq('restaurante_id', restauranteId)
      .in('status', ['approved', 'refunded'])
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('estornos_pedido')
      .select(
        'id, pedido_id, valor, tipo, motivo, status, erro, cancelou_pedido, created_at, pedidos ( id, numero_pedido )'
      )
      .eq('restaurante_id', restauranteId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const primeiro = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

  const listaPagamentos: PagamentoEstornavel[] = (pagamentos ?? []).map((linha) => {
    const pedido = primeiro(linha.pedidos as unknown as (PedidoRelacionado & { id: string }) | (PedidoRelacionado & { id: string })[] | null);
    return {
      id: linha.id as string,
      pedidoId: linha.pedido_id as string,
      paymentId: linha.mercado_pago_payment_id as string,
      status: linha.status as string,
      valor: Number(linha.valor),
      valorEstornado: Number(linha.valor_estornado),
      duplicado: Boolean(linha.duplicado),
      criadoEm: linha.created_at as string,
      numeroPedido: pedido?.numero_pedido ?? null,
      statusPedido: pedido?.status ?? '',
      formaPagamento: pedido?.forma_pagamento ?? (linha.metodo as string) ?? '',
      clienteNome: pedido?.dados_cliente?.nome ?? '',
    };
  });

  const listaEstornos: EstornoHistorico[] = (estornos ?? []).map((linha) => {
    const pedido = primeiro(linha.pedidos as unknown as { id: string; numero_pedido: number | null } | { id: string; numero_pedido: number | null }[] | null);
    return {
      id: linha.id as string,
      pedidoId: linha.pedido_id as string,
      numeroPedido: pedido?.numero_pedido ?? null,
      valor: Number(linha.valor),
      tipo: linha.tipo as string,
      motivo: (linha.motivo as string) ?? '',
      status: linha.status as string,
      erro: (linha.erro as string) ?? null,
      cancelouPedido: Boolean(linha.cancelou_pedido),
      criadoEm: linha.created_at as string,
    };
  });

  return (
    <>
        <section className="bg-white rounded-[24px] p-6 shadow-sm shadow-zinc-300/40 space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Estornos</h1>
            <p className="text-sm text-zinc-500">
              Devolva ao cliente, total ou parcialmente, o valor de pagamentos aprovados no Mercado Pago. O dinheiro
              volta da conta do estabelecimento para o cliente.
            </p>
          </div>

          <ListaEstornosAdmin pagamentos={listaPagamentos} estornos={listaEstornos} />
        </section>
    </>
  );
}
