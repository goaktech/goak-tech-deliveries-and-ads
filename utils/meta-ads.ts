import crypto from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';

const META_GRAPH_BASE_URL = 'https://graph.facebook.com';

const ESCOPO_META_ADS = ['ads_read', 'business_management'].join(',');

type StatusConexao = 'pendente' | 'conectado' | 'desconectado';

interface ConfigOAuthMetaAds {
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

interface AdAccountMeta {
  id: string;
  name?: string;
  account_status?: number;
}

export interface IntegracaoMetaAds {
  id: string;
  restaurante_id: string;
  connection_status: StatusConexao;
  access_token: string | null;
  token_expires_at: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  meta_user_id: string | null;
  meta_user_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsightsDiariosMetaAds {
  impressoes: number;
  cliques: number;
  gasto: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

interface ResultadoConexaoMetaAds {
  restauranteId: string;
  authUrl: string;
}

function getEnvOrThrow(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

function getConfigOAuthMetaAds(): ConfigOAuthMetaAds {
  return {
    appId: getEnvOrThrow(process.env.META_ADS_APP_ID, 'META_ADS_APP_ID'),
    appSecret: getEnvOrThrow(process.env.META_ADS_APP_SECRET, 'META_ADS_APP_SECRET'),
    redirectUri: getEnvOrThrow(process.env.META_ADS_REDIRECT_URI, 'META_ADS_REDIRECT_URI'),
    stateSecret: getEnvOrThrow(process.env.META_ADS_STATE_SECRET, 'META_ADS_STATE_SECRET'),
    apiVersion: process.env.META_ADS_API_VERSION ?? 'v25.0',
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
  }
) {
  const { apiVersion } = getConfigOAuthMetaAds();
  const url = new URL(buildGraphUrl(path, apiVersion));
  for (const [key, value] of Object.entries(options?.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
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

export function gerarStateMetaAds(restauranteId: string) {
  const { stateSecret } = getConfigOAuthMetaAds();
  const payload = JSON.stringify({
    restauranteId,
    nonce: crypto.randomUUID(),
    ts: Date.now(),
  });
  const payloadEncoded = encodeBase64Url(payload);
  const signature = crypto.createHmac('sha256', stateSecret).update(payloadEncoded).digest('hex');
  return `${payloadEncoded}.${signature}`;
}

export function validarStateMetaAds(state: string) {
  const { stateSecret } = getConfigOAuthMetaAds();
  const [payloadEncoded, signature] = state.split('.');
  if (!payloadEncoded || !signature) {
    throw new Error('State OAuth do Meta Ads inválido.');
  }

  const expectedSignature = crypto.createHmac('sha256', stateSecret).update(payloadEncoded).digest('hex');
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error('State OAuth do Meta Ads adulterado.');
  }

  const payload = JSON.parse(decodeBase64Url(payloadEncoded)) as {
    restauranteId?: string;
    ts?: number;
  };

  if (!payload.restauranteId || !payload.ts || Date.now() - payload.ts > 15 * 60 * 1000) {
    throw new Error('State OAuth do Meta Ads expirado ou inválido.');
  }

  return payload;
}

async function trocarCodePorTokenMetaAds(code: string) {
  const { appId, appSecret, redirectUri } = getConfigOAuthMetaAds();
  const url = new URL(`${META_GRAPH_BASE_URL}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);

  const response = await fetch(url.toString());
  const payload = (await response.json()) as TokenMetaOAuth & { error?: { message?: string } };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error?.message || 'Falha ao trocar código OAuth do Meta Ads.');
  }

  return payload;
}

async function trocarPorTokenLongaDuracaoMetaAds(tokenCurto: string) {
  const { appId, appSecret } = getConfigOAuthMetaAds();
  const url = new URL(`${META_GRAPH_BASE_URL}/oauth/access_token`);
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

async function buscarAdAccounts(accessToken: string) {
  const payload = await fetchGraphJson<{ data?: AdAccountMeta[] }>('/me/adaccounts', accessToken, {
    query: { fields: 'id,name,account_status', limit: '100' },
  });

  return payload.data ?? [];
}

async function buscarContaDeAnunciosAtiva(accessToken: string) {
  const contas = await buscarAdAccounts(accessToken);
  const contaAtiva = contas.find((conta) => conta.account_status === 1) ?? contas[0];

  if (!contaAtiva) {
    throw new Error('Nenhuma conta de anúncios foi encontrada para este usuário da Meta.');
  }

  return {
    adAccountId: contaAtiva.id,
    adAccountName: contaAtiva.name ?? null,
  };
}

export async function buscarInsightsDiariosMetaAds(
  accessToken: string,
  adAccountId: string,
  dataISO: string
): Promise<InsightsDiariosMetaAds> {
  const payload = await fetchGraphJson<{
    data?: Array<{
      impressions?: string;
      clicks?: string;
      spend?: string;
      ctr?: string;
      cpc?: string;
      cpm?: string;
    }>;
  }>(`/${adAccountId}/insights`, accessToken, {
    query: {
      fields: 'impressions,clicks,spend,ctr,cpc,cpm',
      time_range: JSON.stringify({ since: dataISO, until: dataISO }),
    },
  });

  const linha = payload.data?.[0];

  return {
    impressoes: linha?.impressions ? Number(linha.impressions) : 0,
    cliques: linha?.clicks ? Number(linha.clicks) : 0,
    gasto: linha?.spend ? Number(linha.spend) : 0,
    ctr: linha?.ctr ? Number(linha.ctr) : 0,
    cpc: linha?.cpc ? Number(linha.cpc) : 0,
    cpm: linha?.cpm ? Number(linha.cpm) : 0,
  };
}

export async function gerarUrlAutorizacaoMetaAds(): Promise<ResultadoConexaoMetaAds> {
  const { appId, redirectUri, apiVersion } = getConfigOAuthMetaAds();
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const state = gerarStateMetaAds(restauranteId);

  const url = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', ESCOPO_META_ADS);
  url.searchParams.set('state', state);

  return {
    restauranteId,
    authUrl: url.toString(),
  };
}

export async function obterIntegracaoMetaAdsPorRestauranteId(restauranteId: string) {
  const supabase = createWebhookAdminClient();
  const { data, error } = await supabase
    .from('restaurante_integracoes_meta_ads')
    .select('*')
    .eq('restaurante_id', restauranteId)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.warn('[meta-ads] Tabela de integração ainda não criada.');
      return null;
    }
    throw new Error(`Falha ao carregar integração de Meta Ads: ${error.message}`);
  }

  return data as IntegracaoMetaAds | null;
}

export async function salvarIntegracaoMetaAds(params: {
  restauranteId: string;
  accessToken: string;
  tokenExpiresIn?: number;
  usuarioMeta: UsuarioMeta;
  adAccountId: string;
  adAccountName: string | null;
}) {
  const supabase = createWebhookAdminClient();
  const agora = new Date().toISOString();
  const tokenExpiresAt =
    params.tokenExpiresIn && params.tokenExpiresIn > 0
      ? new Date(Date.now() + params.tokenExpiresIn * 1000).toISOString()
      : null;

  const { error } = await supabase.from('restaurante_integracoes_meta_ads').upsert(
    {
      restaurante_id: params.restauranteId,
      connection_status: 'conectado',
      access_token: params.accessToken,
      token_expires_at: tokenExpiresAt,
      ad_account_id: params.adAccountId,
      ad_account_name: params.adAccountName,
      meta_user_id: params.usuarioMeta.id,
      meta_user_email: params.usuarioMeta.email ?? null,
      updated_at: agora,
    },
    { onConflict: 'restaurante_id' }
  );

  if (error) {
    throw new Error(`Falha ao salvar integração de Meta Ads: ${error.message}`);
  }
}

export async function concluirConexaoMetaAds(code: string, restauranteId: string) {
  const tokenCurto = await trocarCodePorTokenMetaAds(code);
  const tokenLongo = await trocarPorTokenLongaDuracaoMetaAds(tokenCurto.access_token);
  const accessToken = tokenLongo.access_token;
  const usuarioMeta = await buscarUsuarioMeta(accessToken);
  const { adAccountId, adAccountName } = await buscarContaDeAnunciosAtiva(accessToken);

  await salvarIntegracaoMetaAds({
    restauranteId,
    accessToken,
    tokenExpiresIn: tokenLongo.expires_in,
    usuarioMeta,
    adAccountId,
    adAccountName,
  });

  return { usuarioMeta, adAccountId, adAccountName };
}

export async function desconectarMetaAds(restauranteId: string) {
  const supabase = createWebhookAdminClient();
  const { error } = await supabase
    .from('restaurante_integracoes_meta_ads')
    .update({
      connection_status: 'desconectado',
      access_token: null,
      token_expires_at: null,
      ad_account_id: null,
      ad_account_name: null,
      meta_user_id: null,
      meta_user_email: null,
      updated_at: new Date().toISOString(),
    })
    .eq('restaurante_id', restauranteId);

  if (error) {
    throw new Error(`Falha ao desconectar Meta Ads: ${error.message}`);
  }
}
