import crypto from 'node:crypto';
import { createClient } from '@/utils/supabase/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

const MP_AUTH_URL = 'https://auth.mercadopago.com/authorization';
const MP_API_BASE = 'https://api.mercadopago.com';

export type MetodoPagamentoMercadoPago = 'PIX' | 'CARTAO';

export interface RestauranteIntegracaoPagamento {
  id: string;
  restaurante_id: string;
  provedor: string;
  provider_user_id: string | null;
  access_token: string | null;
  public_key?: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  connection_status: 'pendente' | 'conectado' | 'desconectado';
  account_email: string | null;
  token_refresh_lock_until?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MercadopagoAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string | number;
  public_key?: string;
  scope?: string;
  token_type?: string;
}

interface MercadoPagoUser {
  id: string | number;
  email?: string;
}

interface PedidoMetadata {
  slug: string;
  pedidoId: string;
  codigoAcompanhamento: string;
  externalReference: string;
  dadosCliente: string;
  itens: string;
  metodoPagamento: MetodoPagamentoMercadoPago;
  restauranteId: string;
}

interface IntegracaoLinkResult {
  restauranteId: string;
  authUrl: string;
}

function getEnvOrThrow(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

function getMercadoPagoConfig() {
  return {
    clientId: getEnvOrThrow(process.env.MERCADO_PAGO_CLIENT_ID, 'MERCADO_PAGO_CLIENT_ID'),
    clientSecret: getEnvOrThrow(process.env.MERCADO_PAGO_CLIENT_SECRET, 'MERCADO_PAGO_CLIENT_SECRET'),
    redirectUri: getEnvOrThrow(process.env.MERCADO_PAGO_REDIRECT_URI, 'MERCADO_PAGO_REDIRECT_URI'),
    stateSecret: getEnvOrThrow(process.env.MERCADO_PAGO_STATE_SECRET, 'MERCADO_PAGO_STATE_SECRET'),
    appUrl: getEnvOrThrow(process.env.NEXT_PUBLIC_APP_URL, 'NEXT_PUBLIC_APP_URL'),
  };
}

function encodeBase64Url(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function decodeBase64Url(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function gerarStateMercadoPago(restauranteId: string) {
  const { stateSecret } = getMercadoPagoConfig();
  const payload = JSON.stringify({
    restauranteId,
    nonce: crypto.randomUUID(),
    ts: Date.now(),
  });
  const payloadEncoded = encodeBase64Url(payload);
  const signature = crypto.createHmac('sha256', stateSecret).update(payloadEncoded).digest('hex');
  return `${payloadEncoded}.${signature}`;
}

export function validarStateMercadoPago(state: string) {
  const { stateSecret } = getMercadoPagoConfig();
  const [payloadEncoded, signature] = state.split('.');
  if (!payloadEncoded || !signature) {
    throw new Error('State OAuth inválido.');
  }

  const expectedSignature = crypto.createHmac('sha256', stateSecret).update(payloadEncoded).digest('hex');
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error('State OAuth adulterado.');
  }

  const payload = JSON.parse(decodeBase64Url(payloadEncoded)) as {
    restauranteId?: string;
    nonce?: string;
    ts?: number;
  };

  if (!payload.restauranteId || !payload.ts || Date.now() - payload.ts > 15 * 60 * 1000) {
    throw new Error('State OAuth expirado ou inválido.');
  }

  return payload;
}

export async function obterRestauranteIdDoGestorLogado() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Usuário não autenticado.');
  }

  const { data: perfil, error: perfilError } = await supabase
    .from('perfis_admin')
    .select('restaurante_id')
    .eq('id', user.id)
    .single();

  if (perfilError || !perfil?.restaurante_id) {
    throw new Error('Perfil administrativo sem restaurante vinculado.');
  }

  return perfil.restaurante_id as string;
}

export async function gerarUrlAutorizacaoMercadoPago(): Promise<IntegracaoLinkResult> {
  const { clientId, redirectUri } = getMercadoPagoConfig();
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const state = gerarStateMercadoPago(restauranteId);

  const url = new URL(MP_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('platform_id', 'mp');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  return {
    restauranteId,
    authUrl: url.toString(),
  };
}

export async function obterIntegracaoMercadoPagoPorRestauranteId(restauranteId: string) {
  const supabase = createWebhookAdminClient();
  const { data, error } = await supabase
    .from('restaurante_integracoes_pagamento')
    .select('*')
    .eq('restaurante_id', restauranteId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao carregar integração Mercado Pago: ${error.message}`);
  }

  return data as RestauranteIntegracaoPagamento | null;
}

export async function obterIntegracaoMercadoPagoPorSlug(slug: string) {
  const supabase = createWebhookAdminClient();
  const { data: restaurante, error: errRestaurante } = await supabase
    .from('restaurantes')
    .select('id, nome, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (errRestaurante || !restaurante) {
    throw new Error('Restaurante não encontrado.');
  }

  const integracao = await obterIntegracaoMercadoPagoPorRestauranteId(restaurante.id);

  return {
    restaurante: restaurante as { id: string; nome: string; slug: string },
    integracao,
  };
}

export async function trocarCodigoPorTokensMercadoPago(code: string) {
  const { clientId, clientSecret, redirectUri } = getMercadoPagoConfig();
  const response = await fetch(`${MP_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao trocar code por tokens: ${response.status}`);
  }

  return (await response.json()) as MercadopagoAuthTokens;
}

export class ErroRefreshTokenMercadoPago extends Error {
  constructor(message: string, readonly httpStatus: number, readonly definitivo: boolean) {
    super(message);
    this.name = 'ErroRefreshTokenMercadoPago';
  }
}

export async function renovarTokenMercadoPago(refreshToken: string) {
  const { clientId, clientSecret } = getMercadoPagoConfig();
  const response = await fetch(`${MP_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const corpo = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ErroRefreshTokenMercadoPago(
      `Falha ao renovar token Mercado Pago: ${response.status}`,
      response.status,
      corpo?.error === 'invalid_grant' || response.status === 400 || response.status === 401
    );
  }

  return (await response.json()) as MercadopagoAuthTokens;
}

export async function obterUsuarioMercadoPago(accessToken: string) {
  const response = await fetch(`${MP_API_BASE}/users/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter dados do usuário Mercado Pago: ${response.status}`);
  }

  return (await response.json()) as MercadoPagoUser;
}

export async function salvarIntegracaoMercadoPago(
  restauranteId: string,
  tokens: MercadopagoAuthTokens,
  usuario: MercadoPagoUser
) {
  const supabase = createWebhookAdminClient();
  const agora = new Date().toISOString();
  const { error } = await supabase.from('restaurante_integracoes_pagamento').upsert(
    {
      restaurante_id: restauranteId,
      provedor: 'mercado_pago',
      provider_user_id: String(usuario.id),
      access_token: tokens.access_token,
      ...(tokens.public_key ? { public_key: tokens.public_key } : {}),
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      connection_status: 'conectado',
      account_email: usuario.email ?? null,
      token_refresh_lock_until: null,
      updated_at: agora,
    },
    { onConflict: 'restaurante_id' }
  );

  if (error) {
    throw new Error(`Falha ao salvar integração Mercado Pago: ${error.message}`);
  }
}

export async function desconectarMercadoPago(restauranteId: string) {
  const supabase = createWebhookAdminClient();
  const { error } = await supabase
    .from('restaurante_integracoes_pagamento')
    .update({
      connection_status: 'desconectado',
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      provider_user_id: null,
      account_email: null,
      updated_at: new Date().toISOString(),
    })
    .eq('restaurante_id', restauranteId);

  if (error) {
    throw new Error(`Falha ao desconectar Mercado Pago: ${error.message}`);
  }
}

const LOCK_REFRESH_MS = 30_000;

async function atualizarTokensRenovados(restauranteId: string, tokens: MercadopagoAuthTokens) {
  const supabase = createWebhookAdminClient();
  const { error } = await supabase
    .from('restaurante_integracoes_pagamento')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      ...(tokens.public_key ? { public_key: tokens.public_key } : {}),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      connection_status: 'conectado',
      token_refresh_lock_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('restaurante_id', restauranteId);

  if (error) {
    throw new Error(`Falha ao salvar tokens renovados do Mercado Pago: ${error.message}`);
  }
}

function tokenAindaValido(integracao: RestauranteIntegracaoPagamento) {
  return (
    !!integracao.access_token &&
    (!integracao.token_expires_at || Date.now() < new Date(integracao.token_expires_at).getTime() - 60_000)
  );
}

export async function obterTokenMercadoPagoValido(restauranteId: string): Promise<string> {
  const integracao = await obterIntegracaoMercadoPagoPorRestauranteId(restauranteId);
  if (!integracao || !integracao.access_token || integracao.connection_status !== 'conectado') {
    throw new Error('Mercado Pago não conectado para este restaurante.');
  }

  if (tokenAindaValido(integracao)) {
    return integracao.access_token;
  }

  if (!integracao.refresh_token) {
    await marcarMercadoPagoDesconectadoPorFalhaDeToken(restauranteId);
    throw new Error('Token de atualização ausente para Mercado Pago.');
  }

  const supabase = createWebhookAdminClient();

  for (let tentativa = 0; tentativa < 6; tentativa += 1) {
    // Reivindica o lock de forma atômica: só uma requisição renova (refresh_token é de uso único).
    const agora = new Date();
    const { data: reivindicado, error: errLock } = await supabase
      .from('restaurante_integracoes_pagamento')
      .update({ token_refresh_lock_until: new Date(agora.getTime() + LOCK_REFRESH_MS).toISOString() })
      .eq('restaurante_id', restauranteId)
      .eq('refresh_token', integracao.refresh_token)
      .or(`token_refresh_lock_until.is.null,token_refresh_lock_until.lt.${agora.toISOString()}`)
      .select('restaurante_id');

    if (errLock) {
      throw new Error(`Falha ao reivindicar renovação de token: ${errLock.message}`);
    }

    if (reivindicado && reivindicado.length > 0) {
      try {
        const tokens = await renovarTokenMercadoPago(integracao.refresh_token);
        await atualizarTokensRenovados(restauranteId, tokens);
        return tokens.access_token;
      } catch (error) {
        if (error instanceof ErroRefreshTokenMercadoPago && error.definitivo) {
          await marcarMercadoPagoDesconectadoPorFalhaDeToken(restauranteId);
        } else {
          await supabase
            .from('restaurante_integracoes_pagamento')
            .update({ token_refresh_lock_until: null })
            .eq('restaurante_id', restauranteId);
        }
        throw error;
      }
    }

    // Outra requisição está renovando (ou já renovou): aguarda e relê.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const atual = await obterIntegracaoMercadoPagoPorRestauranteId(restauranteId);
    if (!atual || atual.connection_status !== 'conectado' || !atual.access_token) {
      throw new Error('Mercado Pago não conectado para este restaurante.');
    }
    if (tokenAindaValido(atual)) {
      return atual.access_token;
    }
    if (atual.refresh_token && atual.refresh_token !== integracao.refresh_token) {
      integracao.refresh_token = atual.refresh_token;
    }
  }

  throw new Error('Não foi possível renovar o token do Mercado Pago agora. Tente novamente.');
}

export async function marcarMercadoPagoDesconectadoPorFalhaDeToken(restauranteId: string) {
  const supabase = createWebhookAdminClient();
  await supabase
    .from('restaurante_integracoes_pagamento')
    .update({
      connection_status: 'desconectado',
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      token_refresh_lock_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('restaurante_id', restauranteId);
}

export function montarNotificationUrlMercadoPago(appUrl: string, restauranteId: string) {
  const url = new URL('/api/webhooks/pagamentos', appUrl);
  url.searchParams.set('restaurante_id', restauranteId);
  return url.toString();
}

export function normalizarEmailPayer(email?: string | null, slug?: string, telefone?: string) {
  if (email?.trim()) return email.trim();
  const telefoneNormalizado = telefone?.replace(/\D/g, '') || '000000000';
  const slugNormalizado = (slug || 'loja').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `pagamento-${telefoneNormalizado}@${slugNormalizado}.local`;
}

export function obterEmailPrincipalPix(): string {
  return process.env.PIX_PAYMENT_MAIN_EMAIL?.trim() || 'weldocarvalho@outlook.com';
}

export function montarMetadataPedido(params: {
  slug: string;
  pedidoId: string;
  codigoAcompanhamento: string;
  externalReference: string;
  restauranteId: string;
  metodoPagamento: MetodoPagamentoMercadoPago;
  dadosCliente: unknown;
  itens: unknown;
}) {
  const metadata: PedidoMetadata = {
    slug: params.slug,
    pedidoId: params.pedidoId,
    codigoAcompanhamento: params.codigoAcompanhamento,
    externalReference: params.externalReference,
    restauranteId: params.restauranteId,
    metodoPagamento: params.metodoPagamento,
    dadosCliente: JSON.stringify(params.dadosCliente),
    itens: JSON.stringify(params.itens),
  };

  return metadata;
}


/**
 * Chave pública da conta Mercado Pago da loja (usada no navegador para tokenizar o cartão).
 * Se ainda não foi guardada (loja conectada antes deste recurso), renova o token — a resposta
 * do OAuth traz a chave — e salva. Retorna null se não for possível obter.
 */
export async function obterChavePublicaMercadoPago(restauranteId: string): Promise<string | null> {
  const integracao = await obterIntegracaoMercadoPagoPorRestauranteId(restauranteId);
  if (!integracao || integracao.connection_status !== 'conectado') return null;
  if (integracao.public_key) return integracao.public_key;
  if (!integracao.refresh_token) return null;

  const tokens = await renovarTokenMercadoPago(integracao.refresh_token);
  await salvarIntegracaoMercadoPago(restauranteId, tokens, {
    id: integracao.provider_user_id ?? '',
    email: integracao.account_email ?? undefined,
  });
  return tokens.public_key ?? null;
}

/**
 * Tipos (credit_card, debit_card, prepaid_card...) que o Mercado Pago associa a um meio de pagamento.
 * Pode haver mais de um registro com o mesmo id; lista vazia = não foi possível saber.
 */
export async function obterTiposMeioPagamentoMercadoPago(accessToken: string, paymentMethodId: string) {
  try {
    const response = await fetch(`${MP_API_BASE}/v1/payment_methods`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return [] as string[];
    const lista = (await response.json()) as Array<{ id?: string; payment_type_id?: string }>;
    const tipos = lista
      .filter((meio) => meio.id === paymentMethodId && typeof meio.payment_type_id === 'string')
      .map((meio) => meio.payment_type_id as string);
    return Array.from(new Set(tipos));
  } catch {
    return [] as string[];
  }
}
