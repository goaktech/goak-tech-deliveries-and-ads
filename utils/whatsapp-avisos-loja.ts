// utils/whatsapp-avisos-loja.ts
// Leitura para a tela de Integrações (cenário 2): destinatários da loja e os últimos avisos enviados.
// Usa o service_role, então só deve ser chamada com o restauranteId do gestor logado.

import { createWebhookAdminClient } from '@/utils/supabase/webhook';

export interface DestinatarioAvisoVenda {
  id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
  consentimento_em: string | null;
}

export interface AvisoVendaEnviado {
  id: string;
  criado_em: string;
  sucesso: boolean;
  entrega_status: string | null;
  destinatario: string;
  pedido: string;
}

export async function obterAvisosVendaDaLoja(restauranteId: string) {
  const supabase = createWebhookAdminClient();
  const { data: destinatarios, error } = await supabase
    .from('whatsapp_destinatarios_aviso')
    .select('id, nome, telefone, ativo, consentimento_em')
    .eq('restaurante_id', restauranteId)
    .order('criado_em', { ascending: true });

  // Tabela ainda não criada (migração não aplicada) não pode derrubar a página.
  if (error) {
    console.error('[aviso-venda] Falha ao carregar destinatários.', error);
    return { destinatarios: [] as DestinatarioAvisoVenda[], avisos: [] as AvisoVendaEnviado[], disponivel: false };
  }

  const lista = (destinatarios ?? []) as DestinatarioAvisoVenda[];
  let avisos: AvisoVendaEnviado[] = [];
  if (lista.length) {
    const nomes = new Map(lista.map((d) => [d.id, d.nome]));
    const { data } = await supabase
      .from('avisos_venda_whatsapp')
      .select('id, criado_em, sucesso, entrega_status, destinatario_id, pedidos ( codigo_acompanhamento, numero_pedido )')
      .in('destinatario_id', lista.map((d) => d.id))
      .order('criado_em', { ascending: false })
      .limit(10);

    avisos = (data ?? []).map((linha) => {
      const pedido = (Array.isArray(linha.pedidos) ? linha.pedidos[0] : linha.pedidos) as
        | { codigo_acompanhamento?: string; numero_pedido?: number | null }
        | null;
      return {
        id: linha.id,
        criado_em: linha.criado_em,
        sucesso: linha.sucesso,
        entrega_status: linha.entrega_status,
        destinatario: nomes.get(linha.destinatario_id) ?? '—',
        pedido: pedido?.numero_pedido ? `#${pedido.numero_pedido}` : `#${pedido?.codigo_acompanhamento ?? '—'}`,
      };
    });
  }

  return { destinatarios: lista, avisos, disponivel: true };
}
