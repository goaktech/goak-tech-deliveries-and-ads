import crypto from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';

const META_GRAPH_BASE_URL = 'https://graph.facebook.com';

const ESCOPO_WHATSAPP = [
  'business_management',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
].join(',');

type StatusConexao = 'pendente' | 'conectado' | 'desconectado';

interface ConfigOAuthMeta {
  appId: string;
  appSecret: string;
  redirectUri: string;
  stateSecret: string;
  apiVersion: string;
}

interface TokenMetaOAuth {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface UsuarioMeta {
  id: string;
  name?: string;
  email?: string;
}

interface WhatsappPhoneNumber {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
}

interface WhatsappBusinessAccount {
  id: string;
  name?: string;
  phone_numbers?: {
    data?: WhatsappPhoneNumber[];
  };
}

interface ListaWabasMeta {
  owned_whatsapp_business_accounts?: {
    data?: WhatsappBusinessAccount[];
  };
}

interface MetaBusiness {
  id: string;
  name?: string;
}

interface TemplateWhatsappMeta {
  id?: string;
  name: string;
  status?: string;
  language?: string;
  category?: string;
}

export interface IntegracaoWhatsappBusiness {
  id: string;
  restaurante_id: string;
  connection_status: StatusConexao;
  access_token: string | null;
  token_expires_at: string | null;
  meta_user_id: string | null;
  meta_user_email: string | null;
  waba_id: string | null;
  waba_name: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  template_name: string | null;
  template_language_code: string | null;
  template_status: string | null;
  api_version: string | null;
  created_at: string;
  updated_at: string;
}

interface ResultadoConexaoWhatsapp {
  restauranteId: string;
  authUrl: string;
}

interface ResultadoTemplateEscolhido {
  templateName: string;
  templateLanguageCode: string;
  templateStatus: string;
}

function getEnvOrThrow(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

function getConfigOAuthMeta(): ConfigOAuthMeta {
  return {
    appId: getEnvOrThrow(process.env.WHATSAPP_META_APP_ID, 'WHATSAPP_META_APP_ID'),
    appSecret: getEnvOrThrow(process.env.WHATSAPP_META_APP_SECRET, 'WHATSAPP_META_APP_SECRET'),
    redirectUri: getEnvOrThrow(process.env.WHATSAPP_META_REDIRECT_URI, 'WHATSAPP_META_REDIRECT_URI'),
    stateSecret: getEnvOrThrow(process.env.WHATSAPP_META_STATE_SECRET, 'WHATSAPP_META_STATE_SECRET'),
    apiVersion: process.env.WHATSAPP_BUSINESS_API_VERSION ?? 'v23.0',
  };
}

function buildGraphUrl(path: string, apiVersion: string) {
  return `${META_GRAPH_BASE_URL}/${apiVersion}${path}`;
}

async function fetchGraphJson<T>(
  path: string,
  accessToken: string,
  options?: {
    query?: Record<string, string>;
    method?: 'GET' | 'POST';
    body?: unknown;
  }
) {
  const { apiVersion } = getConfigOAuthMeta();
  const url = new URL(buildGraphUrl(path, apiVersion));
  for (const [key, value] of Object.entries(options?.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: options?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json()) as T & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Falha ao consultar a Graph API da Meta.');
  }

  return payload;
}

function encodeBase64Url(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function decodeBase64Url(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function normalizarNomeTemplate(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

export function gerarStateWhatsappBusiness(restauranteId: string) {
  const { stateSecret } = getConfigOAuthMeta();
  const payload = JSON.stringify({
    restauranteId,
    nonce: crypto.randomUUID(),
    ts: Date.now(),
  });
  const payloadEncoded = encodeBase64Url(payload);
  const signature = crypto.createHmac('sha256', stateSecret).update(payloadEncoded).digest('hex');
  return `${payloadEncoded}.${signature}`;
}

export function validarStateWhatsappBusiness(state: string) {
  const { stateSecret } = getConfigOAuthMeta();
  const [payloadEncoded, signature] = state.split('.');
  if (!payloadEncoded || !signature) {
    throw new Error('State OAuth do WhatsApp inválido.');
  }

  const expectedSignature = crypto.createHmac('sha256', stateSecret).update(payloadEncoded).digest('hex');
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error('State OAuth do WhatsApp adulterado.');
  }

  const payload = JSON.parse(decodeBase64Url(payloadEncoded)) as {
    restauranteId?: string;
    ts?: number;
  };

  if (!payload.restauranteId || !payload.ts || Date.now() - payload.ts > 15 * 60 * 1000) {
    throw new Error('State OAuth do WhatsApp expirado ou inválido.');
  }

  return payload;
}

async function trocarCodePorTokenMeta(code: string) {
  const { appId, appSecret, redirectUri, apiVersion } = getConfigOAuthMeta();
  const url = new URL(buildGraphUrl('/oauth/access_token', apiVersion));
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);

  const response = await fetch(url.toString());
  const payload = (await response.json()) as TokenMetaOAuth & { error?: { message?: string } };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error?.message || 'Falha ao trocar código OAuth da Meta.');
  }

  return payload;
}

async function trocarPorTokenLongaDuracao(tokenCurto: string) {
  const { appId, appSecret, apiVersion } = getConfigOAuthMeta();
  const url = new URL(buildGraphUrl('/oauth/access_token', apiVersion));
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', tokenCurto);

  const response = await fetch(url.toString());
  const payload = (await response.json()) as TokenMetaOAuth & { error?: { message?: string } };
  if (!response.ok || !payload.access_token) {
    return {
      access_token: tokenCurto,
      expires_in: 0,
    };
  }

  return payload;
}

async function buscarUsuarioMeta(accessToken: string) {
  const payload = await fetchGraphJson<UsuarioMeta>('/me', accessToken, {
    query: { fields: 'id,name,email' },
  });

  if (!payload.id) {
    throw new Error('Falha ao carregar usuário da Meta.');
  }

  return payload as UsuarioMeta;
}

async function buscarBusinessesMeta(accessToken: string) {
  const payload = await fetchGraphJson<{ data?: MetaBusiness[] }>('/me/businesses', accessToken, {
    query: { fields: 'id,name', limit: '100' },
  });

  return payload.data ?? [];
}

async function buscarWabasDaBusiness(accessToken: string, businessId: string) {
  const payload = await fetchGraphJson<ListaWabasMeta>(`/${businessId}`, accessToken, {
    query: {
      fields: 'owned_whatsapp_business_accounts{id,name}',
    },
  });

  return payload.owned_whatsapp_business_accounts?.data ?? [];
}

async function buscarPhoneNumbersDaWaba(accessToken: string, wabaId: string) {
  const payload = await fetchGraphJson<{ data?: WhatsappPhoneNumber[] }>(`/${wabaId}/phone_numbers`, accessToken, {
    query: {
      fields: 'id,display_phone_number,verified_name',
      limit: '100',
    },
  });

  return payload.data ?? [];
}

async function buscarWabaEPhoneNumber(accessToken: string) {
  const businesses = await buscarBusinessesMeta(accessToken);
  if (businesses.length === 0) {
    throw new Error('Nenhum Business Manager foi encontrado para este usuário da Meta.');
  }

  for (const business of businesses) {
    const wabas = await buscarWabasDaBusiness(accessToken, business.id);

    for (const conta of wabas) {
      const phoneNumbers = await buscarPhoneNumbersDaWaba(accessToken, conta.id);
      const phone = phoneNumbers[0];
      if (!phone?.id) {
        continue;
      }

      return {
        businessId: business.id,
        businessName: business.name ?? null,
        wabaId: conta.id,
        wabaName: conta.name ?? null,
        phoneNumberId: phone.id,
        displayPhoneNumber: phone.display_phone_number ?? phone.verified_name ?? null,
      };
    }
  }

  throw new Error('Nenhuma conta de WhatsApp Business com número ativo foi encontrada para os negócios vinculados.');
}

async function listarTemplatesWhatsapp(accessToken: string, wabaId: string) {
  const payload = await fetchGraphJson<{ data?: TemplateWhatsappMeta[] }>(`/${wabaId}/message_templates`, accessToken, {
    query: {
      fields: 'id,name,status,language,category',
      limit: '100',
    },
  });

  return payload.data ?? [];
}

async function criarTemplatePadraoWhatsapp(accessToken: string, wabaId: string) {
  const templateName = normalizarNomeTemplate(`status_pedido_${Date.now().toString(36)}`);

  const payload = await fetchGraphJson<{
    id?: string;
    status?: string;
  }>(`/${wabaId}/message_templates`, accessToken, {
    method: 'POST',
    body: {
      name: templateName,
      language: 'pt_BR',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: 'Olá! Atualização do pedido de {{1}}: {{2}}. {{3}} Acompanhe aqui: {{4}}',
        },
      ],
    },
  });

  if (!payload.id) {
    throw new Error('Falha ao criar template padrão de status de pedido.');
  }

  return {
    templateName,
    templateLanguageCode: 'pt_BR',
    templateStatus: payload.status ?? 'PENDING',
  };
}

async function selecionarTemplateStatusPedido(accessToken: string, wabaId: string): Promise<ResultadoTemplateEscolhido> {
  const templates = await listarTemplatesWhatsapp(accessToken, wabaId);
  const nomePreferido = process.env.WHATSAPP_TEMPLATE_STATUS_PEDIDO;
  const templatePreferido = nomePreferido
    ? templates.find(
        (template) =>
          template.name === nomePreferido &&
          typeof template.status === 'string' &&
          template.status.toUpperCase() === 'APPROVED'
      )
    : null;

  if (templatePreferido) {
    return {
      templateName: templatePreferido.name,
      templateLanguageCode: templatePreferido.language ?? 'pt_BR',
      templateStatus: templatePreferido.status ?? 'APPROVED',
    };
  }

  const templateAprovado = templates.find(
    (template) => typeof template.status === 'string' && template.status.toUpperCase() === 'APPROVED'
  );

  if (templateAprovado) {
    return {
      templateName: templateAprovado.name,
      templateLanguageCode: templateAprovado.language ?? 'pt_BR',
      templateStatus: templateAprovado.status ?? 'APPROVED',
    };
  }

  return criarTemplatePadraoWhatsapp(accessToken, wabaId);
}

export async function gerarUrlAutorizacaoWhatsappBusiness(): Promise<ResultadoConexaoWhatsapp> {
  const { appId, redirectUri, apiVersion } = getConfigOAuthMeta();
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const state = gerarStateWhatsappBusiness(restauranteId);

  const url = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', ESCOPO_WHATSAPP);
  url.searchParams.set('state', state);

  return {
    restauranteId,
    authUrl: url.toString(),
  };
}

export async function obterIntegracaoWhatsappBusinessPorRestauranteId(restauranteId: string) {
  const supabase = createWebhookAdminClient();
  const { data, error } = await supabase
    .from('restaurante_integracoes_whatsapp_business')
    .select('*')
    .eq('restaurante_id', restauranteId)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') {
      console.warn('[whatsapp-business] Tabela de integração ainda não criada.');
      return null;
    }
    throw new Error(`Falha ao carregar integração de WhatsApp Business: ${error.message}`);
  }

  return data as IntegracaoWhatsappBusiness | null;
}

export async function salvarIntegracaoWhatsappBusiness(params: {
  restauranteId: string;
  accessToken: string;
  tokenExpiresIn?: number;
  usuarioMeta: UsuarioMeta;
  wabaId: string;
  wabaName: string | null;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  templateName: string;
  templateLanguageCode: string;
  templateStatus: string;
  apiVersion: string;
}) {
  const supabase = createWebhookAdminClient();
  const agora = new Date().toISOString();
  const tokenExpiresAt =
    params.tokenExpiresIn && params.tokenExpiresIn > 0
      ? new Date(Date.now() + params.tokenExpiresIn * 1000).toISOString()
      : null;

  const { error } = await supabase.from('restaurante_integracoes_whatsapp_business').upsert(
    {
      restaurante_id: params.restauranteId,
      connection_status: 'conectado',
      access_token: params.accessToken,
      token_expires_at: tokenExpiresAt,
      meta_user_id: params.usuarioMeta.id,
      meta_user_email: params.usuarioMeta.email ?? null,
      waba_id: params.wabaId,
      waba_name: params.wabaName,
      phone_number_id: params.phoneNumberId,
      display_phone_number: params.displayPhoneNumber,
      template_name: params.templateName,
      template_language_code: params.templateLanguageCode,
      template_status: params.templateStatus,
      api_version: params.apiVersion,
      updated_at: agora,
      created_at: agora,
    },
    { onConflict: 'restaurante_id' }
  );

  if (error) {
    throw new Error(`Falha ao salvar integração de WhatsApp Business: ${error.message}`);
  }
}

export async function concluirConexaoWhatsappBusiness(code: string, restauranteId: string) {
  const tokenCurto = await trocarCodePorTokenMeta(code);
  const tokenLongo = await trocarPorTokenLongaDuracao(tokenCurto.access_token);
  const accessToken = tokenLongo.access_token;
  const usuarioMeta = await buscarUsuarioMeta(accessToken);
  const { wabaId, wabaName, phoneNumberId, displayPhoneNumber } = await buscarWabaEPhoneNumber(accessToken);
  const template = await selecionarTemplateStatusPedido(accessToken, wabaId);
  const { apiVersion } = getConfigOAuthMeta();

  await salvarIntegracaoWhatsappBusiness({
    restauranteId,
    accessToken,
    tokenExpiresIn: tokenLongo.expires_in,
    usuarioMeta,
    wabaId,
    wabaName,
    phoneNumberId,
    displayPhoneNumber,
    templateName: template.templateName,
    templateLanguageCode: template.templateLanguageCode,
    templateStatus: template.templateStatus,
    apiVersion,
  });

  return {
    usuarioMeta,
    wabaId,
    phoneNumberId,
    template,
  };
}

export async function desconectarWhatsappBusiness(restauranteId: string) {
  const supabase = createWebhookAdminClient();
  const { error } = await supabase
    .from('restaurante_integracoes_whatsapp_business')
    .update({
      connection_status: 'desconectado',
      access_token: null,
      token_expires_at: null,
      meta_user_id: null,
      meta_user_email: null,
      waba_id: null,
      waba_name: null,
      phone_number_id: null,
      display_phone_number: null,
      template_name: null,
      template_language_code: null,
      template_status: null,
      updated_at: new Date().toISOString(),
    })
    .eq('restaurante_id', restauranteId);

  if (error) {
    throw new Error(`Falha ao desconectar WhatsApp Business: ${error.message}`);
  }
}
