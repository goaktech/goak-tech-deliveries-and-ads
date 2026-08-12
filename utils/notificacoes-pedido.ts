import webpush from 'web-push';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { obterIntegracaoWhatsappBusinessPorRestauranteId } from '@/utils/whatsapp-business';
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

interface ConfigWhatsapp {
  accessToken: string;
  phoneNumberId: string;
  templateName: string;
  languageCode: string;
  apiVersion: string;
}

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

async function getWhatsappConfig(restauranteId: string): Promise<ConfigWhatsapp | null> {
  const integracao = await obterIntegracaoWhatsappBusinessPorRestauranteId(restauranteId);
  if (
    integracao?.connection_status === 'conectado' &&
    integracao.access_token &&
    integracao.phone_number_id &&
    integracao.template_name
  ) {
    if (integracao.template_status && integracao.template_status.toUpperCase() !== 'APPROVED') {
      console.warn('[pedido:notificacao] Template do WhatsApp ainda não aprovado.');
      return null;
    }

    return {
      accessToken: integracao.access_token,
      phoneNumberId: integracao.phone_number_id,
      templateName: integracao.template_name,
      languageCode: integracao.template_language_code ?? 'pt_BR',
      apiVersion: integracao.api_version ?? 'v23.0',
    };
  }

  const accessToken = process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_STATUS_PEDIDO;

  if (!accessToken || !phoneNumberId || !templateName) {
    return null;
  }

  return {
    accessToken,
    phoneNumberId,
    templateName,
    languageCode: process.env.WHATSAPP_TEMPLATE_LANGUAGE_CODE ?? 'pt_BR',
    apiVersion: process.env.WHATSAPP_BUSINESS_API_VERSION ?? 'v23.0',
  };
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

function normalizarTelefoneWhatsapp(telefone?: string | null): string | null {
  const digitos = String(telefone ?? '').replace(/\D/g, '');
  if (!digitos) {
    return null;
  }

  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }

  if (digitos.length >= 12) {
    return digitos;
  }

  return null;
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
  const config = await getWhatsappConfig(pedido.restaurante.id);
  if (!config) {
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

  const payload = {
    messaging_product: 'whatsapp',
    to: telefone,
    type: 'template',
    template: {
      name: config.templateName,
      language: { code: config.languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: pedido.restaurante.nome },
            { type: 'text', text: titulo },
            { type: 'text', text: descricao || 'Acompanhe o pedido em tempo real.' },
            { type: 'text', text: trackingUrl },
          ],
        },
      ],
    },
  } as const;

  try {
    const resposta = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const body = await resposta.json();
    if (!resposta.ok) {
      throw new Error(body?.error?.message || 'Falha ao enviar WhatsApp Business.');
    }

    await registrarLogNotificacao({
      pedidoId: pedido.id,
      canal: 'whatsapp',
      status: pedido.status,
      sucesso: true,
      providerMessageId: body?.messages?.[0]?.id ?? null,
      payload: body,
    });
  } catch (error) {
    await registrarLogNotificacao({
      pedidoId: pedido.id,
      canal: 'whatsapp',
      status: pedido.status,
      sucesso: false,
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

  try {
    await enviarWhatsappStatusPedido(pedido, tipoEntrega);
  } catch (error) {
    console.error('[pedido:notificacao] Erro ao enviar atualização por WhatsApp.', error);
  }

  try {
    await enviarPushStatusPedido(pedido, tipoEntrega);
  } catch (error) {
    console.error('[pedido:notificacao] Erro ao enviar atualização push.', error);
  }
}
