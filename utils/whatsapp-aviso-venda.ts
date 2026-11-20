// utils/whatsapp-aviso-venda.ts
// Cenário 2: aviso INTERNO de venda por WhatsApp (dono da loja + equipe Appetitoso).
// Disparado quando o pedido passa de PENDENTE para PAGO. Nunca lança erro: falhar aqui
// não pode atrapalhar o pagamento nem o pedido.

import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { enviarTemplateWhatsapp, obterRemetentePlataforma } from '@/utils/whatsapp-envio';

export interface PedidoParaAvisoVenda {
  id: string;
  codigoAcompanhamento: string;
  valorTotal: number;
  nomeCliente?: string | null;
  restaurante: { id: string; nome: string };
}

function formatarReais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function enviarAvisoVendaWhatsapp(pedido: PedidoParaAvisoVenda) {
  try {
    const template = process.env.WHATSAPP_TEMPLATE_AVISO_VENDA;
    const remetente = obterRemetentePlataforma();
    if (!template || !remetente) {
      console.warn('[aviso-venda] WhatsApp do Appetitoso ou template de aviso não configurado.');
      return;
    }

    const supabase = createWebhookAdminClient();
    // Só recebe quem concordou (consentimento_em preenchido) e está ativo.
    const { data: destinatarios, error } = await supabase
      .from('whatsapp_destinatarios_aviso')
      .select('id, nome, telefone')
      .eq('ativo', true)
      .not('consentimento_em', 'is', null)
      .or(`restaurante_id.is.null,restaurante_id.eq.${pedido.restaurante.id}`);

    if (error) {
      console.error('[aviso-venda] Falha ao buscar destinatários.', error);
      return;
    }

    const parametros = [
      pedido.restaurante.nome,
      `#${pedido.codigoAcompanhamento}`,
      formatarReais(pedido.valorTotal),
      pedido.nomeCliente?.trim() || 'Cliente',
    ];

    for (const destinatario of destinatarios ?? []) {
      // "Reserva" a linha antes de enviar: a restrição UNIQUE (pedido, destinatário)
      // impede aviso duplicado mesmo com webhooks do pagamento chegando em paralelo.
      const { data: reserva, error: erroReserva } = await supabase
        .from('avisos_venda_whatsapp')
        .insert({ pedido_id: pedido.id, destinatario_id: destinatario.id })
        .select('id')
        .single();

      if (erroReserva || !reserva) {
        if (erroReserva?.code !== '23505') console.error('[aviso-venda] Falha ao reservar envio.', erroReserva);
        continue;
      }

      try {
        const { messageId } = await enviarTemplateWhatsapp({
          remetente,
          para: destinatario.telefone,
          template,
          parametros,
        });
        await supabase
          .from('avisos_venda_whatsapp')
          .update({ sucesso: true, provider_message_id: messageId })
          .eq('id', reserva.id);
      } catch (erroEnvio) {
        await supabase
          .from('avisos_venda_whatsapp')
          .update({ erro_json: { message: erroEnvio instanceof Error ? erroEnvio.message : String(erroEnvio) } })
          .eq('id', reserva.id);
        console.error('[aviso-venda] Falha ao enviar aviso.', { pedidoId: pedido.id, destinatario: destinatario.id });
      }
    }
  } catch (erro) {
    console.error('[aviso-venda] Erro inesperado.', erro);
  }
}
