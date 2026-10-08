import crypto from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';

const META_GRAPH_BASE_URL = 'https://graph.facebook.com';

const ESCOPO_META_ADS = ['ads_read', 'business_management'].join(',');

/** Fuso usado quando a conta de anúncios ainda não informou o seu. */
const FUSO_PADRAO = 'America/Sao_Paulo';

/** Tokens de longa duração valem ~60 dias; avisamos para reconectar com essa antecedência. */
const DIAS_AVISO_EXPIRACAO = 7;

/** Limite de páginas ao listar contas de anúncios (100 por página). */
const MAX_PAGINAS_CONTAS = 5;

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

export interface AdAccountMeta {
  id: string;
  name?: string;
  account_status?: number;
  currency?: string;
  timezone_name?: string;
}

export interface IntegracaoMetaAds {
  id: string;
  restaurante_id: string;
  connection_status: StatusConexao;
  access_token: string | null;
  token_expires_at: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  ad_account_currency: string | null;
  ad_account_timezone: string | null;
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
  nonce: string;
}

/** Erro devolvido pela Graph API (guarda o código para distinguir token inválido de falha comum). */
export class ErroGraphMetaAds extends Error {
  constructor(
    message: string,
    public readonly codigo?: number,
    public readonly subcodigo?: number
  ) {
    super(message);
    this.name = 'ErroGraphMetaAds';
  }
}

/** Token expirado, revogado ou inválido: só resolve reconectando a conta. */
export function ehErroTokenMetaAds(error: unknown): boolean {
  return error instanceof ErroGraphMetaAds && error.codigo === 190;
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
    // v25.0 é suportada até 29/07/2028 (confirmado em 08/10/2026); a v26.0 já existe.
    // Para trocar de versão basta definir META_ADS_API_VERSION, sem mexer no código.
    apiVersion: process.env.META_ADS_API_VERSION ?? 'v25.0',
  };
}

function buildGraphUrl(path: string, apiVersion: string) {
  return `${META_GRAPH_BASE_URL}/${apiVersion}${path}`;
}

function erroDaGraph(payload: unknown, mensagemPadrao: string): ErroGraphMetaAds {
  const erro = (payload as { error?: { message?: string; code?: number; error_subcode?: number } } | null)?.error;
  return new ErroGraphMetaAds(erro?.message || mensagemPadrao, erro?.code, erro?.error_subcode);
}

async function fetchGraphJson<T>(
  path: string,
  accessToken: string,
  options?: {
    query?: Record<string, string>;
    method?: 'GET' | 'DELETE';
  }
) {
  const { apiVersion } = getConfigOAuthMetaAds();
  const url = new URL(buildGraphUrl(path, apiVersion));
  for (const [key, value] of Object.entries(options?.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: options?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as (T & { error?: unknown }) | null;

  if (!response.ok || !payload) {
    throw erroDaGraph(payload, 'Falha ao consultar a Graph API da Meta.');
  }

  return payload as T;
}

function encodeBase64Url(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function decodeBase64Url(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function compararAssinaturas(recebida: string, esperada: string) {
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function gerarNonceMetaAds() {
  return crypto.randomUUID();
}

export function gerarStateMetaAds(restauranteId: string, nonce: string) {
  const { stateSecret } = getConfigOAuthMetaAds();
  const payload = JSON.stringify({
    restauranteId,
    nonce,
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
  if (!compararAssinaturas(signature, expectedSignature)) {
    throw new Error('State OAuth do Meta Ads adulterado.');
  }

  const payload = JSON.parse(decodeBase64Url(payloadEncoded)) as {
    restauranteId?: string;
    nonce?: string;
    ts?: number;
  };

  if (!payload.restauranteId || !payload.nonce || !payload.ts || Date.now() - payload.ts > 15 * 60 * 1000) {
    throw new Error('State OAuth do Meta Ads expirado ou inválido.');
  }

  return payload as { restauranteId: string; nonce: string; ts: number };
}

async function trocarCodePorTokenMetaAds(code: string) {
  const { appId, appSecret, redirectUri } = getConfigOAuthMetaAds();
  const url = new URL(`${META_GRAPH_BASE_URL}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);

  const response = await fetch(url.toString());
  const payload = (await response.json().catch(() => null)) as (TokenMetaOAuth & { error?: unknown }) | null;
  if (!response.ok || !payload?.access_token) {
    throw erroDaGraph(payload, 'Falha ao trocar código OAuth do Meta Ads.');
  }

  return payload;
}

/**
 * Troca o token curto (1–2 h) por um de longa duração (~60 dias). Se a troca falhar,
 * a conexão inteira falha: gravar o token curto como se não expirasse deixaria a
 * integração "conectada" por um par de horas e quebrada depois, sem aviso.
 */
async function trocarPorTokenLongaDuracaoMetaAds(tokenCurto: string) {
  const { appId, appSecret } = getConfigOAuthMetaAds();
  const url = new URL(`${META_GRAPH_BASE_URL}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', tokenCurto);

  const response = await fetch(url.toString());
  const payload = (await response.json().catch(() => null)) as (TokenMetaOAuth & { error?: unknown }) | null;
  if (!response.ok || !payload?.access_token) {
    throw erroDaGraph(payload, 'Falha ao obter o token de longa duração da Meta.');
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

/** Lista as contas de anúncios do usuário, seguindo a paginação da Graph API. */
export async function buscarAdAccounts(accessToken: string): Promise<AdAccountMeta[]> {
  const contas: AdAccountMeta[] = [];
  let proximaUrl: string | null = null;

  for (let pagina = 0; pagina < MAX_PAGINAS_CONTAS; pagina += 1) {
    let payload: { data?: AdAccountMeta[]; paging?: { next?: string } };

    if (proximaUrl) {
      const resposta = await fetch(proximaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      const corpo = (await resposta.json().catch(() => null)) as typeof payload | null;
      if (!resposta.ok || !corpo) {
        throw erroDaGraph(corpo, 'Falha ao listar contas de anúncios da Meta.');
      }
      payload = corpo;
    } else {
      payload = await fetchGraphJson<typeof payload>('/me/adaccounts', accessToken, {
        query: { fields: 'id,name,account_status,currency,timezone_name', limit: '100' },
      });
    }

    contas.push(...(payload.data ?? []));
    proximaUrl = payload.paging?.next ?? null;
    if (!proximaUrl) break;
  }

  return contas;
}

function escolherContaPadrao(contas: AdAccountMeta[]) {
  return contas.find((conta) => conta.account_status === 1) ?? contas[0] ?? null;
}

/** Data de hoje (AAAA-MM-DD) no fuso da conta de anúncios. */
export function dataDeHojeNoFuso(timezone: string | null | undefined): string {
  const formatar = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      new Date()
    );

  try {
    return formatar(timezone || FUSO_PADRAO);
  } catch {
    return formatar(FUSO_PADRAO);
  }
}

export interface InsightDiaMetaAds extends InsightsDiariosMetaAds {
  data: string;
}

/** Insights dia a dia (time_increment=1) de um intervalo; dias sem veiculação não vêm na resposta. */
export async function buscarInsightsPeriodoMetaAds(
  accessToken: string,
  adAccountId: string,
  desde: string,
  ate: string
): Promise<InsightDiaMetaAds[]> {
  const payload = await fetchGraphJson<{
    data?: Array<{
      date_start?: string;
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
      time_range: JSON.stringify({ since: desde, until: ate }),
      time_increment: '1',
      limit: '60',
    },
  });

  return (payload.data || [])
    .filter((linha) => linha.date_start)
    .map((linha) => ({
      data: linha.date_start as string,
      impressoes: Number(linha.impressions) || 0,
      cliques: Number(linha.clicks) || 0,
      gasto: Number(linha.spend) || 0,
      ctr: Number(linha.ctr) || 0,
      cpc: Number(linha.cpc) || 0,
      cpm: Number(linha.cpm) || 0,
    }));
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
  const nonce = gerarNonceMetaAds();
  const state = gerarStateMetaAds(restauranteId, nonce);

  const url = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', ESCOPO_META_ADS);
  url.searchParams.set('state', state);

  return {
    restauranteId,
    authUrl: url.toString(),
    nonce,
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

export type EstadoTokenMetaAds = 'ausente' | 'ok' | 'expirando' | 'expirado';

/**
 * Situação do token da integração. `token_expires_at` no passado também marca um token
 * que a Meta recusou (ver `marcarTokenMetaAdsInvalido`), então "expirado" = precisa reconectar.
 */
export function avaliarTokenMetaAds(
  integracao: Pick<IntegracaoMetaAds, 'connection_status' | 'access_token' | 'token_expires_at'> | null
): { estado: EstadoTokenMetaAds; diasRestantes: number | null } {
  if (!integracao || integracao.connection_status !== 'conectado' || !integracao.access_token) {
    return { estado: 'ausente', diasRestantes: null };
  }

  if (!integracao.token_expires_at) {
    return { estado: 'ok', diasRestantes: null };
  }

  const msRestantes = new Date(integracao.token_expires_at).getTime() - Date.now();
  if (msRestantes <= 0) {
    return { estado: 'expirado', diasRestantes: 0 };
  }

  const diasRestantes = Math.ceil(msRestantes / (24 * 60 * 60 * 1000));
  return { estado: diasRestantes <= DIAS_AVISO_EXPIRACAO ? 'expirando' : 'ok', diasRestantes };
}

/** A Meta recusou o token (código 190): marca como expirado para a tela pedir reconexão. */
export async function marcarTokenMetaAdsInvalido(restauranteId: string) {
  const supabase = createWebhookAdminClient();
  const agora = new Date().toISOString();
  const { error } = await supabase
    .from('restaurante_integracoes_meta_ads')
    .update({ token_expires_at: agora, updated_at: agora })
    .eq('restaurante_id', restauranteId);

  if (error) {
    console.error('[meta-ads] Falha ao marcar token como inválido:', error.message);
  }
}

export async function salvarIntegracaoMetaAds(params: {
  restauranteId: string;
  accessToken: string;
  tokenExpiresIn?: number;
  usuarioMeta: UsuarioMeta;
  conta: AdAccountMeta;
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
      ad_account_id: params.conta.id,
      ad_account_name: params.conta.name ?? null,
      ad_account_currency: params.conta.currency ?? null,
      ad_account_timezone: params.conta.timezone_name ?? null,
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

  const contas = await buscarAdAccounts(accessToken);
  const integracaoAnterior = await obterIntegracaoMetaAdsPorRestauranteId(restauranteId);
  // Reconectando: mantém a conta que o gestor já tinha escolhido, se ela ainda existir.
  const contaAnterior = integracaoAnterior?.ad_account_id
    ? contas.find((conta) => conta.id === integracaoAnterior.ad_account_id)
    : null;
  const conta = contaAnterior ?? escolherContaPadrao(contas);

  if (!conta) {
    throw new Error('Nenhuma conta de anúncios foi encontrada para este usuário da Meta.');
  }

  await salvarIntegracaoMetaAds({
    restauranteId,
    accessToken,
    tokenExpiresIn: tokenLongo.expires_in,
    usuarioMeta,
    conta,
  });

  return { usuarioMeta, adAccountId: conta.id, adAccountName: conta.name ?? null };
}

/** Lista as contas de anúncios disponíveis para o gestor trocar a conta vinculada. */
export async function listarContasAnunciosDoRestaurante(restauranteId: string) {
  const integracao = await obterIntegracaoMetaAdsPorRestauranteId(restauranteId);
  if (avaliarTokenMetaAds(integracao).estado === 'ausente' || !integracao?.access_token) {
    throw new Error('Conecte o Meta Ads antes de escolher a conta de anúncios.');
  }

  try {
    const contas = await buscarAdAccounts(integracao.access_token);
    return { contas, contaAtualId: integracao.ad_account_id };
  } catch (error) {
    if (ehErroTokenMetaAds(error)) {
      await marcarTokenMetaAdsInvalido(restauranteId);
      throw new Error('A conexão com a Meta expirou. Reconecte o Meta Ads.');
    }
    throw error;
  }
}

export async function selecionarContaAnunciosMetaAds(restauranteId: string, adAccountId: string) {
  const { contas } = await listarContasAnunciosDoRestaurante(restauranteId);
  const conta = contas.find((c) => c.id === adAccountId);
  if (!conta) {
    throw new Error('Conta de anúncios não encontrada para este usuário da Meta.');
  }

  const supabase = createWebhookAdminClient();
  const { error } = await supabase
    .from('restaurante_integracoes_meta_ads')
    .update({
      ad_account_id: conta.id,
      ad_account_name: conta.name ?? null,
      ad_account_currency: conta.currency ?? null,
      ad_account_timezone: conta.timezone_name ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('restaurante_id', restauranteId);

  if (error) {
    throw new Error(`Falha ao salvar a conta de anúncios: ${error.message}`);
  }

  // O cache de métricas era da conta anterior.
  await supabase.from('metricas_meta_ads_diarias').delete().eq('restaurante_id', restauranteId);

  return { adAccountId: conta.id, adAccountName: conta.name ?? null };
}

async function revogarPermissoesMetaAds(accessToken: string) {
  // Revoga só as permissões deste módulo (sem derrubar outras autorizações do usuário no app).
  for (const permissao of ESCOPO_META_ADS.split(',')) {
    try {
      await fetchGraphJson(`/me/permissions/${permissao}`, accessToken, { method: 'DELETE' });
    } catch (error) {
      // Token já inválido ou permissão já revogada: o objetivo (perder o acesso) está cumprido.
      console.warn(`[meta-ads] Não foi possível revogar a permissão ${permissao}:`, (error as Error).message);
    }
  }
}

function limparIntegracaoPayload() {
  return {
    connection_status: 'desconectado' as const,
    access_token: null,
    token_expires_at: null,
    ad_account_id: null,
    ad_account_name: null,
    ad_account_currency: null,
    ad_account_timezone: null,
    meta_user_id: null,
    meta_user_email: null,
    updated_at: new Date().toISOString(),
  };
}

export async function desconectarMetaAds(restauranteId: string) {
  const integracao = await obterIntegracaoMetaAdsPorRestauranteId(restauranteId);
  if (integracao?.access_token) {
    await revogarPermissoesMetaAds(integracao.access_token);
  }

  const supabase = createWebhookAdminClient();
  const { error } = await supabase
    .from('restaurante_integracoes_meta_ads')
    .update(limparIntegracaoPayload())
    .eq('restaurante_id', restauranteId);

  if (error) {
    throw new Error(`Falha ao desconectar Meta Ads: ${error.message}`);
  }

  await supabase.from('metricas_meta_ads_diarias').delete().eq('restaurante_id', restauranteId);
}

/**
 * Valida o `signed_request` que a Meta envia nos callbacks de desautorização e de
 * exclusão de dados: `<assinatura>.<payload>` (base64url), HMAC-SHA256 com o segredo do app.
 */
export function validarSignedRequestMetaAds(signedRequest: string): { user_id: string } {
  const { appSecret } = getConfigOAuthMetaAds();
  const [assinaturaEncoded, payloadEncoded] = signedRequest.split('.');
  if (!assinaturaEncoded || !payloadEncoded) {
    throw new Error('signed_request inválido.');
  }

  const esperada = crypto.createHmac('sha256', appSecret).update(payloadEncoded).digest('base64url');
  if (!compararAssinaturas(assinaturaEncoded, esperada)) {
    throw new Error('Assinatura do signed_request inválida.');
  }

  const payload = JSON.parse(decodeBase64Url(payloadEncoded)) as { user_id?: string; algorithm?: string };
  if (!payload.user_id || (payload.algorithm && payload.algorithm.toUpperCase() !== 'HMAC-SHA256')) {
    throw new Error('Payload do signed_request inválido.');
  }

  return { user_id: String(payload.user_id) };
}

/** Remove token, dados da conta Meta e métricas em cache de quem desautorizou o app ou pediu exclusão. */
export async function removerDadosDoUsuarioMetaAds(metaUserId: string) {
  const supabase = createWebhookAdminClient();
  const { data: integracoes, error } = await supabase
    .from('restaurante_integracoes_meta_ads')
    .select('restaurante_id')
    .eq('meta_user_id', metaUserId);

  if (error) {
    throw new Error(`Falha ao localizar integrações do usuário Meta: ${error.message}`);
  }

  for (const { restaurante_id: restauranteId } of integracoes ?? []) {
    const { error: errUpdate } = await supabase
      .from('restaurante_integracoes_meta_ads')
      .update(limparIntegracaoPayload())
      .eq('restaurante_id', restauranteId);
    if (errUpdate) {
      throw new Error(`Falha ao remover integração Meta Ads: ${errUpdate.message}`);
    }
    await supabase.from('metricas_meta_ads_diarias').delete().eq('restaurante_id', restauranteId);
  }

  return (integracoes ?? []).length;
}

/** Traduz erros do fluxo de conexão em um motivo curto e seguro para a URL de retorno. */
export function motivoErroConexaoMetaAds(error: unknown): string {
  const mensagem = error instanceof Error ? error.message : '';
  if (/state/i.test(mensagem) || /nonce/i.test(mensagem) || /sessão/i.test(mensagem)) return 'estado-invalido';
  if (/Nenhuma conta de anúncios/i.test(mensagem)) return 'sem-conta';
  if (/longa duração|token/i.test(mensagem)) return 'token';
  return 'erro';
}
