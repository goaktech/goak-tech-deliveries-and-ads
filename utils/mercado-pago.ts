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
  refresh_token: string | null;
  token_expires_at: string | null;
  connection_status: 'pendente' | 'conectado' | 'desconectado';
  account_email: string | null;
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
    throw new Error(`Falha ao renovar token Mercado Pago: ${response.status}`);
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
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      connection_status: 'conectado',
      account_email: usuario.email ?? null,
      updated_at: agora,
      created_at: agora,
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

export async function obterTokenMercadoPagoValido(restauranteId: string) {
  const integracao = await obterIntegracaoMercadoPagoPorRestauranteId(restauranteId);
  if (!integracao || !integracao.access_token || integracao.connection_status !== 'conectado') {
    throw new Error('Mercado Pago não conectado para este restaurante.');
  }

  if (!integracao.token_expires_at || Date.now() < new Date(integracao.token_expires_at).getTime() - 60_000) {
    return integracao.access_token;
  }

  if (!integracao.refresh_token) {
    throw new Error('Token de atualização ausente para Mercado Pago.');
  }

  const tokens = await renovarTokenMercadoPago(integracao.refresh_token);
  await salvarIntegracaoMercadoPago(restauranteId, tokens, {
    id: integracao.provider_user_id ?? '',
    email: integracao.account_email ?? undefined,
  });
  return tokens.access_token;
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

