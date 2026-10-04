// utils/ifood.ts
// Integração com a Merchant API do iFood (app DISTRIBUÍDO: cada lojista
// autoriza o goak a operar a própria loja). Fluxo de conexão:
//   1. gestor informa o ID da loja (merchantId) → geramos um userCode;
//   2. lojista aprova no Portal do Parceiro e recebe um authorizationCode;
//   3. trocamos o código por accessToken/refreshToken e conferimos que a
//      loja autorizada é a mesma do ID informado.
// Tokens ficam só no banco (service role) — nunca vão para o cliente.
//
// Requisitos de homologação já cobertos aqui: renovação do token antes de
// expirar, retry com backoff exponencial + jitter em 429/5xx/rede e
// idempotency-key em operações que alteram estado.

import { randomUUID } from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

const MARGEM_RENOVACAO_MS = 5 * 60 * 1000;
const MAX_TENTATIVAS = 4;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StatusConexaoIfood = 'pendente' | 'conectado' | 'desconectado';

export interface EnderecoLojaIfood {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface RestauranteIntegracaoIfood {
  id: string;
  restaurante_id: string;
  merchant_id: string | null;
  merchant_nome: string | null;
  merchant_razao_social: string | null;
  merchant_status: string | null;
  merchant_endereco: EnderecoLojaIfood | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  authorization_code_verifier: string | null;
  user_code: string | null;
  verification_url: string | null;
  user_code_expires_at: string | null;
  connection_status: StatusConexaoIfood;
  dados_atualizados_em: string | null;
  entregas_pelo_ifood: boolean | null;
  acrescimo_taxa_entrega: number | string | null;
  created_at: string;
  updated_at: string;
}

/** O que pode ir para o navegador: sem tokens nem verifier. */
export interface IntegracaoIfoodPublica {
  merchantId: string | null;
  merchantNome: string | null;
  merchantRazaoSocial: string | null;
  merchantStatus: string | null;
  merchantEndereco: EnderecoLojaIfood | null;
  connectionStatus: StatusConexaoIfood;
  userCode: string | null;
  verificationUrl: string | null;
  userCodeExpiraEm: string | null;
  dadosAtualizadosEm: string | null;
  entregasPeloIfood: boolean;
  acrescimoTaxaEntrega: number;
}

export interface DadosLojaIfood {
  id: string;
  nome: string | null;
  razaoSocial: string | null;
  status: string | null;
  endereco: EnderecoLojaIfood;
}

interface RespostaIfood<T> {
  status: number;
  body: T | null;
  texto: string;
}

interface TokensIfood {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

interface UserCodeIfood {
  userCode: string;
  authorizationCodeVerifier: string;
  verificationUrl?: string;
  verificationUrlComplete?: string;
  expiresIn: number;
}

function getEnvOrThrow(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

function getIfoodConfig() {
  return {
    clientId: getEnvOrThrow(process.env.IFOOD_CLIENT_ID, 'IFOOD_CLIENT_ID'),
    clientSecret: getEnvOrThrow(process.env.IFOOD_CLIENT_SECRET, 'IFOOD_CLIENT_SECRET'),
    baseUrl: process.env.IFOOD_API_BASE_URL || 'https://merchant-api.ifood.com.br',
  };
}

function getSupabase() {
  return createWebhookAdminClient();
}

export function merchantIdValido(merchantId: string) {
  return UUID_REGEX.test(merchantId.trim());
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chamada HTTP à API do iFood com retry (1s, 2s, 4s + jitter) em falhas
 * transitórias. POSTs levam idempotency-key — a mesma em todas as
 * tentativas, para o iFood não executar a operação duas vezes.
 */
export async function requisicaoIfood<T>(
  caminho: string,
  opcoes: {
    method?: 'GET' | 'POST';
    accessToken?: string;
    form?: Record<string, string>;
    json?: unknown;
    query?: Record<string, string | number>;
    headers?: Record<string, string>;
  } = {}
): Promise<RespostaIfood<T>> {
  const { baseUrl } = getIfoodConfig();
  const method = opcoes.method ?? 'GET';
  const url = new URL(caminho, baseUrl);
  for (const [chave, valor] of Object.entries(opcoes.query ?? {})) {
    url.searchParams.set(chave, String(valor));
  }

  const headers: Record<string, string> = { ...(opcoes.headers ?? {}) };
  let body: string | undefined;
  if (opcoes.form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(opcoes.form).toString();
  } else if (opcoes.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opcoes.json);
  }
  if (opcoes.accessToken) {
    headers.authorization = `Bearer ${opcoes.accessToken}`;
  }
  if (method === 'POST' && !headers['idempotency-key']) {
    headers['idempotency-key'] = randomUUID();
  }

  for (let tentativa = 1; ; tentativa++) {
    let resposta: Response | null = null;
    try {
      resposta = await fetch(url, { method, headers, body, cache: 'no-store' });
    } catch (erro) {
      if (tentativa >= MAX_TENTATIVAS) {
        throw erro;
      }
    }

    if (resposta) {
      const transitorio = resposta.status === 429 || resposta.status >= 500;
      if (!transitorio || tentativa >= MAX_TENTATIVAS) {
        const texto = await resposta.text();
        let json: T | null = null;
        try {
          json = texto ? (JSON.parse(texto) as T) : null;
        } catch {
          json = null;
        }
        if (resposta.status >= 400) {
          console.error(`iFood ${method} ${caminho} → ${resposta.status}`, texto.slice(0, 500));
        }
        return { status: resposta.status, body: json, texto };
      }
    }

    const retryAfter = Number(resposta?.headers.get('retry-after') ?? 0);
    const atrasoMs = Math.max(2 ** (tentativa - 1) * 1000, retryAfter * 1000) + Math.random() * 1000;
    console.warn(`iFood ${method} ${caminho}: falha transitória (${resposta?.status ?? 'rede'}), tentativa ${tentativa}.`);
    await esperar(atrasoMs);
  }
}

// ------------------------------------------------------------ autenticação

export async function gerarUserCodeIfood() {
  const { clientId } = getIfoodConfig();
  const resposta = await requisicaoIfood<UserCodeIfood>('/authentication/v1.0/oauth/userCode', {
    method: 'POST',
    form: { clientId },
  });

  if (resposta.status !== 200 || !resposta.body?.userCode) {
    throw new Error('Não foi possível gerar o código de vínculo no iFood.');
  }
  return resposta.body;
}

async function solicitarTokens(form: Record<string, string>): Promise<TokensIfood> {
  const { clientId, clientSecret } = getIfoodConfig();
  const resposta = await requisicaoIfood<TokensIfood>('/authentication/v1.0/oauth/token', {
    method: 'POST',
    form: { clientId, clientSecret, ...form },
  });

  if (resposta.status !== 200 || !resposta.body?.accessToken) {
    throw new Error(
      resposta.status === 401 || resposta.status === 400
        ? 'Código de autorização inválido ou expirado. Gere um novo código e tente de novo.'
        : 'Falha ao autenticar no iFood.'
    );
  }
  return resposta.body;
}

export function trocarAuthorizationCodeIfood(authorizationCode: string, verifier: string) {
  return solicitarTokens({
    grantType: 'authorization_code',
    authorizationCode,
    authorizationCodeVerifier: verifier,
  });
}

function renovarTokenIfood(refreshToken: string) {
  return solicitarTokens({ grantType: 'refresh_token', refreshToken });
}

export function expiracaoDoToken(expiresIn: number) {
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

// ------------------------------------------------------------ persistência

export async function obterIntegracaoIfoodPorRestauranteId(restauranteId: string) {
  const { data, error } = await getSupabase()
    .from('restaurante_integracoes_ifood')
    .select('*')
    .eq('restaurante_id', restauranteId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao carregar integração iFood: ${error.message}`);
  }
  return data as RestauranteIntegracaoIfood | null;
}

export async function salvarIntegracaoIfood(restauranteId: string, campos: Partial<RestauranteIntegracaoIfood>) {
  const { error } = await getSupabase()
    .from('restaurante_integracoes_ifood')
    .upsert(
      { restaurante_id: restauranteId, ...campos, updated_at: new Date().toISOString() },
      { onConflict: 'restaurante_id' }
    );

  if (error) {
    if (error.code === '23505') {
      throw new Error('Esta loja iFood já está conectada a outro estabelecimento do goak.');
    }
    throw new Error(`Falha ao salvar integração iFood: ${error.message}`);
  }
}

export function paraIntegracaoIfoodPublica(integracao: RestauranteIntegracaoIfood | null): IntegracaoIfoodPublica | null {
  if (!integracao) {
    return null;
  }
  return {
    merchantId: integracao.merchant_id,
    merchantNome: integracao.merchant_nome,
    merchantRazaoSocial: integracao.merchant_razao_social,
    merchantStatus: integracao.merchant_status,
    merchantEndereco: integracao.merchant_endereco,
    connectionStatus: integracao.connection_status,
    userCode: integracao.user_code,
    verificationUrl: integracao.verification_url,
    userCodeExpiraEm: integracao.user_code_expires_at,
    dadosAtualizadosEm: integracao.dados_atualizados_em,
    entregasPeloIfood: integracao.entregas_pelo_ifood === true,
    acrescimoTaxaEntrega: Number(integracao.acrescimo_taxa_entrega ?? 0),
  };
}

/**
 * Access token válido da loja, renovado via refresh token quando faltam
 * menos de 5 minutos para expirar. Se a renovação falhar (lojista revogou
 * o acesso, refresh expirado), a integração volta para "desconectado".
 */
export async function obterAccessTokenIfood(restauranteId: string) {
  const integracao = await obterIntegracaoIfoodPorRestauranteId(restauranteId);
  if (!integracao || integracao.connection_status !== 'conectado' || !integracao.access_token) {
    throw new Error('Loja iFood não conectada.');
  }

  const expiraEm = integracao.token_expires_at ? new Date(integracao.token_expires_at).getTime() : 0;
  if (expiraEm - MARGEM_RENOVACAO_MS > Date.now()) {
    return integracao.access_token;
  }

  if (!integracao.refresh_token) {
    await salvarIntegracaoIfood(restauranteId, { connection_status: 'desconectado', access_token: null });
    throw new Error('Acesso ao iFood expirou. Conecte a loja novamente.');
  }

  try {
    const tokens = await renovarTokenIfood(integracao.refresh_token);
    await salvarIntegracaoIfood(restauranteId, {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? integracao.refresh_token,
      token_expires_at: expiracaoDoToken(tokens.expiresIn),
    });
    return tokens.accessToken;
  } catch (erro) {
    console.error('Falha ao renovar token iFood:', erro);
    await salvarIntegracaoIfood(restauranteId, {
      connection_status: 'desconectado',
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
    });
    throw new Error('Acesso ao iFood expirou ou foi revogado. Conecte a loja novamente.');
  }
}

// ------------------------------------------------------------ loja (merchant)

/** IDs das lojas que este token pode operar. */
export async function listarLojasAutorizadasIfood(accessToken: string) {
  const resposta = await requisicaoIfood<Array<{ id: string; name?: string }>>('/merchant/v1.0/merchants', {
    accessToken,
  });
  if (resposta.status !== 200 || !Array.isArray(resposta.body)) {
    throw new Error('Não foi possível listar as lojas autorizadas no iFood.');
  }
  return resposta.body;
}

interface MerchantDetalhesBruto {
  id: string;
  name?: string;
  corporateName?: string;
  status?: string;
  address?: {
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  };
}

export async function buscarDadosLojaIfood(accessToken: string, merchantId: string): Promise<DadosLojaIfood> {
  const resposta = await requisicaoIfood<MerchantDetalhesBruto>(`/merchant/v1.0/merchants/${merchantId}`, {
    accessToken,
  });

  if (resposta.status === 403 || resposta.status === 404) {
    throw new Error('Loja não encontrada ou sem permissão para este ID.');
  }
  if (resposta.status !== 200 || !resposta.body) {
    throw new Error('Não foi possível buscar os dados da loja no iFood.');
  }

  const loja = resposta.body;
  const a = loja.address ?? {};
  // No cadastro do iFood o "street" às vezes já vem com número e bairro
  // ("Ramal Bujari, 122, Bujari") — guardamos só o logradouro.
  const logradouro = a.street ? a.street.split(',')[0].trim() : null;

  return {
    id: loja.id,
    nome: loja.name ?? null,
    razaoSocial: loja.corporateName ?? null,
    status: loja.status ?? null,
    endereco: {
      logradouro,
      numero: a.number ?? null,
      bairro: a.district ?? null,
      cidade: a.city ?? null,
      estado: a.state ?? null,
      cep: a.postalCode ?? null,
      latitude: typeof a.latitude === 'number' ? a.latitude : null,
      longitude: typeof a.longitude === 'number' ? a.longitude : null,
    },
  };
}

export function formatarEnderecoLojaIfood(endereco: EnderecoLojaIfood | null) {
  if (!endereco) {
    return '';
  }
  return [endereco.logradouro, endereco.numero, endereco.bairro, endereco.cidade, endereco.estado]
    .filter(Boolean)
    .join(', ');
}
