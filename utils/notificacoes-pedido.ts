import webpush from 'web-push';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import {
  enviarTemplateWhatsapp,
  normalizarTelefoneWhatsapp,
  resolverRemetenteWhatsapp,
} from '@/utils/whatsapp-envio';
import {
  type DadosClientePedido,
  type StatusPedido,
  type TipoEntregaPedido,
  obterDescricaoStatusPedido,
  obterTituloStatusPedido,
} from '@/utils/pedido-status';

export interface PedidoParaNotificacao {
  id: string;
  status: StatusPedido;
  codigoAcompanhamento: string;
  dadosCliente: DadosClientePedido;
  restaurante: {
    id: string;
    nome: string;
    slug: string;
  };
}

type CanalNotificacao = 'whatsapp' | 'push';

interface ConfigWebPush {
  publicKey: string;
  privateKey: string;
  subject: string;
}

function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL não configurada para notificações de pedido.');
  }
  return appUrl;
}

function getWebPushConfig(): ConfigWebPush | null {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

function serializarErro(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'object' && error !== null) {
    return error;
  }

  return { value: String(error) };
}

function montarTrackingUrl(slug: string, codigoAcompanhamento: string) {
  const url = new URL(`/${slug}/acompanhar/${codigoAcompanhamento}`, getAppUrl());
  return url.toString();
}

async function notificacaoJaEnviadaComSucesso(
  pedidoId: string,
  canal: CanalNotificacao,
  status: StatusPedido
) {
  const supabase = createWebhookAdminClient();
  const { data } = await supabase
    .from('notificacoes_pedido')
    .select('id')
    .eq('pedido_id', pedidoId)
    .eq('canal', canal)
    .eq('status_destino', status)
    .eq('sucesso', true)
    .limit(1)
    .maybeSingle();

  return Boolean(data?.id);
}

async function registrarLogNotificacao(params: {
  pedidoId: string;
  canal: CanalNotificacao;
  status: StatusPedido;
  sucesso: boolean;
  providerMessageId?: string | null;
  payload?: Record<string, unknown> | null;
  erro?: unknown;
}) {
  const supabase = createWebhookAdminClient();
  await supabase.from('notificacoes_pedido').insert({
    pedido_id: params.pedidoId,
    canal: params.canal,
    status_destino: params.status,
    sucesso: params.sucesso,
    provider_message_id: params.providerMessageId ?? null,
    payload_json: params.payload ?? null,
    erro_json: params.erro ? serializarErro(params.erro) : null,
  });
}

async function enviarWhatsappStatusPedido(
  pedido: PedidoParaNotificacao,
  tipoEntrega: TipoEntregaPedido
) {
  // Cenário 3/4: o remetente é o número do Appetitoso, salvo loja liberada com conexão própria.
  const remetente = await resolverRemetenteWhatsapp(pedido.restaurante.id);
  if (!remetente) {
    console.warn('[pedido:notificacao] WhatsApp Business não configurado.');
    return;
  }

  const telefone = normalizarTelefoneWhatsapp(pedido.dadosCliente.telefone);
  if (!telefone) {
    console.warn('[pedido:notificacao] Telefone inválido para WhatsApp.', { pedidoId: pedido.id });
    return;
  }

  if (await notificacaoJaEnviadaComSucesso(pedido.id, 'whatsapp', pedido.status)) {
    return;
  }

  const trackingUrl = montarTrackingUrl(pedido.restaurante.slug, pedido.codigoAcompanhamento);
  const titulo = obterTituloStatusPedido(pedido.status, tipoEntrega);
  const descricao = obterDescricaoStatusPedido(pedido.status, tipoEntrega);

  try {
    const { messageId, resposta } = await enviarTemplateWhatsapp({
      remetente,
      para: telefone,
      template: remetente.templateStatusPedido,
      parametros: [
        pedido.restaurante.nome,
        titulo,
        descricao || 'Acompanhe o pedido em tempo real.',
        trackingUrl,
      ],
    });

    await registrarLogNotificacao({
      pedidoId: pedido.id,
      canal: 'whatsapp',
      status: pedido.status,
      sucesso: true,
      providerMessageId: messageId,
      payload: { origem: remetente.origem, resposta },
    });
  } catch (error) {
    await registrarLogNotificacao({
      pedidoId: pedido.id,
      canal: 'whatsapp',
      status: pedido.status,
      sucesso: false,
      payload: { origem: remetente.origem },
      erro: error,
    });
    throw error;
  }
}

async function enviarPushStatusPedido(pedido: PedidoParaNotificacao, tipoEntrega: TipoEntregaPedido) {
  const config = getWebPushConfig();
  if (!config) {
    console.warn('[pedido:notificacao] Web Push não configurado.');
    return;
  }

  if (await notificacaoJaEnviadaComSucesso(pedido.id, 'push', pedido.status)) {
    return;
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const supabase = createWebhookAdminClient();
  const { data: subscriptions } = await supabase
    .from('push_subscriptions_pedido')
    .select('id, endpoint, p256dh, auth')
    .eq('pedido_id', pedido.id);

  if (!subscriptions || subscriptions.length === 0) {
    return;
  }

  const trackingUrl = montarTrackingUrl(pedido.restaurante.slug, pedido.codigoAcompanhamento);
  const titulo = obterTituloStatusPedido(pedido.status, tipoEntrega);
  const body = obterDescricaoStatusPedido(pedido.status, tipoEntrega);

  const payload = JSON.stringify({
    title: `${pedido.restaurante.nome}`,
    body: `${titulo}${body ? ` • ${body}` : ''}`,
    url: trackingUrl,
    tag: `pedido-${pedido.codigoAcompanhamento}`,
  });

  const idsRemover: string[] = [];

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload
      );
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number((error as { statusCode?: number }).statusCode) : undefined;
      if (statusCode === 404 || statusCode === 410) {
        idsRemover.push(subscription.id);
      }
      console.error('[pedido:notificacao] Falha ao enviar push.', error);
    }
  }

  if (idsRemover.length > 0) {
    await supabase.from('push_subscriptions_pedido').delete().in('id', idsRemover);
  }

  await registrarLogNotificacao({
    pedidoId: pedido.id,
    canal: 'push',
    status: pedido.status,
    sucesso: true,
    payload: { subscriptions: subscriptions.length },
  });
}

export async function enviarNotificacoesStatusPedido(pedido: PedidoParaNotificacao) {
  const tipoEntrega = pedido.dadosCliente.tipoEntrega ?? 'ENTREGA';

  await Promise.all([
    enviarWhatsappStatusPedido(pedido, tipoEntrega).catch((error) => {
      console.error('[pedido:notificacao] Erro ao enviar atualização por WhatsApp.', error);
    }),
    enviarPushStatusPedido(pedido, tipoEntrega).catch((error) => {
      console.error('[pedido:notificacao] Erro ao enviar atualização push.', error);
    }),
  ]);
}
