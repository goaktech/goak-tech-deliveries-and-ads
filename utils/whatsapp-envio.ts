// utils/whatsapp-envio.ts
// Camada única de envio de WhatsApp (Cloud API). Decide QUAL número envia
// (Appetitoso ou, no futuro, o da própria loja) e fala com a Graph API.

import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { obterIntegracaoWhatsappBusinessPorRestauranteId } from '@/utils/whatsapp-business';

export type OrigemRemetenteWhatsapp = 'plataforma' | 'loja';

export interface RemetenteWhatsapp {
  origem: OrigemRemetenteWhatsapp;
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  languageCode: string;
  /** Template de atualização de status do pedido (cliente). */
  templateStatusPedido: string;
}

const VERSAO_API_PADRAO = 'v23.0';

/** Credencial do Appetitoso (única, via variáveis de ambiente). */
export function obterRemetentePlataforma(): RemetenteWhatsapp | null {
  const accessToken = process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
  const templateStatusPedido = process.env.WHATSAPP_TEMPLATE_STATUS_PEDIDO;
  if (!accessToken || !phoneNumberId || !templateStatusPedido) return null;

  return {
    origem: 'plataforma',
    accessToken,
    phoneNumberId,
    apiVersion: process.env.WHATSAPP_BUSINESS_API_VERSION ?? VERSAO_API_PADRAO,
    languageCode: process.env.WHATSAPP_TEMPLATE_LANGUAGE_CODE ?? 'pt_BR',
    templateStatusPedido,
  };
}

/**
 * Gancho do cenário 4: escolhe o remetente de uma loja.
 * A credencial da própria loja só é usada quando o Appetitoso liberou
 * (restaurantes.whatsapp_proprio_liberado) E a conexão está ativa com template aprovado.
 * Em qualquer outro caso, usa o número do Appetitoso.
 */
export async function resolverRemetenteWhatsapp(restauranteId: string): Promise<RemetenteWhatsapp | null> {
  const supabase = createWebhookAdminClient();
  const { data: loja } = await supabase
    .from('restaurantes')
    .select('whatsapp_proprio_liberado')
    .eq('id', restauranteId)
    .maybeSingle();

  if (loja?.whatsapp_proprio_liberado === true) {
    const integracao = await obterIntegracaoWhatsappBusinessPorRestauranteId(restauranteId);
    const aprovado = !integracao?.template_status || integracao.template_status.toUpperCase() === 'APPROVED';
    const expirado = integracao?.token_expires_at
      ? new Date(integracao.token_expires_at).getTime() <= Date.now()
      : false;

    if (
      integracao?.connection_status === 'conectado' &&
      integracao.access_token &&
      integracao.phone_number_id &&
      integracao.template_name &&
      aprovado &&
      !expirado
    ) {
      return {
        origem: 'loja',
        accessToken: integracao.access_token,
        phoneNumberId: integracao.phone_number_id,
        apiVersion: integracao.api_version ?? VERSAO_API_PADRAO,
        languageCode: integracao.template_language_code ?? 'pt_BR',
        templateStatusPedido: integracao.template_name,
      };
    }
    console.warn('[whatsapp] Loja liberada para número próprio, mas a conexão não está pronta; usando o Appetitoso.', {
      restauranteId,
    });
  }

  return obterRemetentePlataforma();
}

/** Aceita celular/fixo BR com DDD (10 ou 11 dígitos) ou número já com 55 (12 ou 13 dígitos). */
export function normalizarTelefoneWhatsapp(telefone?: string | null): string | null {
  const digitos = String(telefone ?? '').replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return digitos;
  return null;
}

export async function enviarTemplateWhatsapp(params: {
  remetente: Pick<RemetenteWhatsapp, 'accessToken' | 'phoneNumberId' | 'apiVersion' | 'languageCode'>;
  para: string;
  template: string;
  parametros: string[];
}): Promise<{ messageId: string | null; resposta: unknown }> {
  const { remetente } = params;
  const resposta = await fetch(
    `https://graph.facebook.com/${remetente.apiVersion}/${remetente.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${remetente.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: params.para,
        type: 'template',
        template: {
          name: params.template,
          language: { code: remetente.languageCode },
          components: [
            {
              type: 'body',
              // A Meta rejeita parâmetros com quebra de linha, tabulação ou 4+ espaços seguidos.
              parameters: params.parametros.map((texto) => ({
                type: 'text',
                text: String(texto).replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim() || '-',
              })),
            },
          ],
        },
      }),
    }
  );

  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(corpo?.error?.message || `Falha ao enviar WhatsApp (HTTP ${resposta.status}).`);
  }

  return { messageId: corpo?.messages?.[0]?.id ?? null, resposta: corpo };
}
