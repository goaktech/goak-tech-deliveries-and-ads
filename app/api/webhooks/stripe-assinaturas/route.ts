import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { normalizarSlug, obterClienteStripe, obterWebhookSecretStripe } from '@/utils/stripe-assinaturas';

interface PayloadProvisionamento {
  nomeRestaurante: string;
  emailAdmin: string;
  tipoRestaurante: string;
  slugSugerido: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  statusAssinatura: string;
  periodoInicio: string | null;
  periodoFim: string | null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro interno desconhecido.';
}

function validarEmail(email: string) {
  return email.includes('@') && email.length >= 5;
}

async function obterSlugDisponivel(supabase: ReturnType<typeof createWebhookAdminClient>, base: string) {
  const baseLimpa = normalizarSlug(base) || `restaurante-${Date.now()}`;

  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    const sufixo = tentativa === 0 ? '' : `-${tentativa + 1}`;
    const candidato = `${baseLimpa}${sufixo}`;

    const { data, error } = await supabase
      .from('restaurantes')
      .select('id')
      .eq('slug', candidato)
      .maybeSingle();

    if (error) {
      throw new Error(`Falha ao validar slug disponível: ${error.message}`);
    }

    if (!data) {
      return candidato;
    }
  }

  throw new Error('Não foi possível gerar slug disponível.');
}

async function inserirEventoWebhookStripe(
  supabase: ReturnType<typeof createWebhookAdminClient>,
  evento: Stripe.Event,
  payload: string
) {
  const { error } = await supabase.from('eventos_webhook_stripe').insert({
    stripe_event_id: evento.id,
    tipo_evento: evento.type,
    payload_json: JSON.parse(payload),
  });

  if (!error) {
    return true;
  }

  if (error.code === '23505') {
    return false;
  }

  throw new Error(`Falha ao registrar evento do Stripe: ${error.message}`);
}

async function buscarUsuarioPorEmail(
  supabase: ReturnType<typeof createWebhookAdminClient>,
  email: string
) {
  for (let pagina = 1; pagina <= 10; pagina += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) {
      throw new Error(`Falha ao listar usuários: ${error.message}`);
    }

    const usuario = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (usuario) {
      return usuario;
    }

    if (data.users.length < 200) {
      break;
    }
  }

  return null;
}

async function garantirAcessoAdmin(
  supabase: ReturnType<typeof createWebhookAdminClient>,
  params: { restauranteId: string; emailAdmin: string; nomeRestaurante: string; appUrl: string }
) {
  const existente = await buscarUsuarioPorEmail(supabase, params.emailAdmin);
  if (existente) {
    const { error: erroPerfil } = await supabase.from('perfis_admin').upsert(
      {
        id: existente.id,
        restaurante_id: params.restauranteId,
        nome: params.nomeRestaurante,
      },
      { onConflict: 'id' }
    );

    if (erroPerfil) {
      throw new Error(`Falha ao vincular perfil admin existente: ${erroPerfil.message}`);
    }

    const { error: erroMagic } = await supabase.auth.signInWithOtp({
      email: params.emailAdmin,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${params.appUrl}/admin/cozinha`,
      },
    });

    if (erroMagic) {
      throw new Error(`Falha ao enviar magic link para administrador existente: ${erroMagic.message}`);
    }

    return;
  }

  const { data: convite, error: erroConvite } = await supabase.auth.admin.inviteUserByEmail(params.emailAdmin, {
    redirectTo: `${params.appUrl}/admin/cozinha`,
    data: {
      nome: params.nomeRestaurante,
      papel: 'gestor',
    },
  });

  if (erroConvite || !convite.user?.id) {
    throw new Error(`Falha ao convidar administrador por e-mail: ${erroConvite?.message ?? 'usuário ausente'}`);
  }

  const { error: erroPerfil } = await supabase.from('perfis_admin').upsert(
    {
      id: convite.user.id,
      restaurante_id: params.restauranteId,
      nome: params.nomeRestaurante,
    },
    { onConflict: 'id' }
  );

  if (erroPerfil) {
    throw new Error(`Falha ao criar perfil admin: ${erroPerfil.message}`);
  }
}

async function provisionarRestaurante(supabase: ReturnType<typeof createWebhookAdminClient>, payload: PayloadProvisionamento) {
  const { data: existente, error: erroExistente } = await supabase
    .from('restaurantes')
    .select('id, slug')
    .eq('gateway_customer_id', payload.stripeCustomerId)
    .maybeSingle();

  if (erroExistente) {
    throw new Error(`Falha ao consultar restaurante existente: ${erroExistente.message}`);
  }

  if (existente) {
    const { error: erroAtualizacao } = await supabase
      .from('restaurantes')
      .update({
        status_assinatura: payload.statusAssinatura,
        email_corporativo: payload.emailAdmin,
        nome: payload.nomeRestaurante,
        tipo: payload.tipoRestaurante,
      })
      .eq('id', existente.id);

    if (erroAtualizacao) {
      throw new Error(`Falha ao atualizar restaurante existente: ${erroAtualizacao.message}`);
    }

    return existente.id;
  }

  const slugDisponivel = await obterSlugDisponivel(supabase, payload.slugSugerido || payload.nomeRestaurante);

  const { data: novoRestaurante, error: erroCriacao } = await supabase
    .from('restaurantes')
    .insert({
      nome: payload.nomeRestaurante,
      tipo: payload.tipoRestaurante || 'restaurante',
      slug: slugDisponivel,
      status_assinatura: payload.statusAssinatura,
      gateway_customer_id: payload.stripeCustomerId,
      email_corporativo: payload.emailAdmin,
    })
    .select('id')
    .single();

  if (erroCriacao || !novoRestaurante?.id) {
    throw new Error(`Falha ao criar restaurante: ${erroCriacao?.message ?? 'ID não retornado'}`);
  }

  return novoRestaurante.id;
}

async function salvarAssinatura(
  supabase: ReturnType<typeof createWebhookAdminClient>,
  restauranteId: string,
  payload: PayloadProvisionamento
) {
  const { error } = await supabase.from('assinaturas_plataforma').upsert(
    {
      restaurante_id: restauranteId,
      stripe_customer_id: payload.stripeCustomerId,
      stripe_subscription_id: payload.stripeSubscriptionId,
      stripe_price_id: payload.stripePriceId,
      status: payload.statusAssinatura,
      periodo_inicio: payload.periodoInicio,
      periodo_fim: payload.periodoFim,
      cancel_at_period_end: false,
    },
    { onConflict: 'stripe_subscription_id' }
  );

  if (error) {
    throw new Error(`Falha ao salvar assinatura da plataforma: ${error.message}`);
  }
}

function extrairPayloadProvisionamento(evento: Stripe.Event): PayloadProvisionamento | null {
  if (evento.type !== 'checkout.session.completed') {
    return null;
  }

  const sessao = evento.data.object as Stripe.Checkout.Session;
  const metadata = sessao.metadata ?? {};

  const nomeRestaurante = String(metadata.nome_restaurante ?? '').trim();
  const emailAdmin = String(metadata.email_admin ?? sessao.customer_details?.email ?? '').trim().toLowerCase();
  const tipoRestaurante = String(metadata.tipo_restaurante ?? 'restaurante').trim().toLowerCase();
  const slugSugerido = normalizarSlug(String(metadata.slug_sugerido ?? nomeRestaurante));
  const stripeCustomerId = typeof sessao.customer === 'string' ? sessao.customer : '';
  const stripeSubscriptionId = typeof sessao.subscription === 'string' ? sessao.subscription : '';
  const stripePriceId = typeof metadata.stripe_price_id === 'string' ? metadata.stripe_price_id : null;

  if (!nomeRestaurante || !validarEmail(emailAdmin) || !slugSugerido || !stripeCustomerId || !stripeSubscriptionId) {
    return null;
  }

  return {
    nomeRestaurante,
    emailAdmin,
    tipoRestaurante,
    slugSugerido,
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId,
    statusAssinatura: 'ativa',
    periodoInicio: null,
    periodoFim: null,
  };
}

export async function POST(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL não configurada.' }, { status: 500 });
  }

  try {
    const assinatura = request.headers.get('stripe-signature');
    if (!assinatura) {
      return NextResponse.json({ error: 'Assinatura Stripe ausente.' }, { status: 400 });
    }

    const payloadRaw = await request.text();
    const stripe = obterClienteStripe();
    const webhookSecret = obterWebhookSecretStripe();
    const evento = stripe.webhooks.constructEvent(payloadRaw, assinatura, webhookSecret);
    const supabase = createWebhookAdminClient();

    const eventoNovo = await inserirEventoWebhookStripe(supabase, evento, payloadRaw);
    if (!eventoNovo) {
      return NextResponse.json({ received: true, deduplicated: true });
    }

    if (evento.type !== 'checkout.session.completed') {
      return NextResponse.json({ received: true });
    }

    const sessao = evento.data.object as Stripe.Checkout.Session;
    if (sessao.payment_status !== 'paid') {
      return NextResponse.json({ received: true, ignored: 'pagamento_nao_liquidado' });
    }

    const payload = extrairPayloadProvisionamento(evento);
    if (!payload) {
      throw new Error('Metadados obrigatórios ausentes no checkout da assinatura.');
    }

    const restauranteId = await provisionarRestaurante(supabase, payload);
    await salvarAssinatura(supabase, restauranteId, payload);
    await garantirAcessoAdmin(supabase, {
      restauranteId,
      emailAdmin: payload.emailAdmin,
      nomeRestaurante: payload.nomeRestaurante,
      appUrl,
    });

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('Erro no webhook de assinatura Stripe:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
