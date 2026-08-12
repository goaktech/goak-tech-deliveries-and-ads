import { NextResponse } from 'next/server';
import { obterClienteStripe, obterPriceIdAssinatura, normalizarSlug } from '@/utils/stripe-assinaturas';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro interno desconhecido.';
}

function validarEmail(email: string) {
  return email.includes('@') && email.length >= 5;
}

export async function POST(request: Request) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL não configurada.' }, { status: 500 });
    }

    const body = await request.json();
    const nomeRestaurante = String(body?.nomeRestaurante ?? '').trim();
    const emailAdmin = String(body?.emailAdmin ?? '').trim().toLowerCase();
    const tipoRestaurante = String(body?.tipoRestaurante ?? 'restaurante').trim().toLowerCase();
    const slugSugerido = normalizarSlug(String(body?.slugSugerido ?? nomeRestaurante));

    if (!nomeRestaurante || nomeRestaurante.length < 2) {
      return NextResponse.json({ error: 'Nome do restaurante inválido.' }, { status: 400 });
    }

    if (!validarEmail(emailAdmin)) {
      return NextResponse.json({ error: 'E-mail de administrador inválido.' }, { status: 400 });
    }

    if (!slugSugerido) {
      return NextResponse.json({ error: 'Slug sugerido inválido.' }, { status: 400 });
    }

    const stripe = obterClienteStripe();
    const priceId = obterPriceIdAssinatura();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: emailAdmin,
      success_url: `${appUrl}/assinar/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/assinar?status=cancelado`,
      metadata: {
        nome_restaurante: nomeRestaurante,
        email_admin: emailAdmin,
        tipo_restaurante: tipoRestaurante,
        slug_sugerido: slugSugerido,
        stripe_price_id: priceId,
        origem: 'landing',
      },
      allow_promotion_codes: true,
      locale: 'pt-BR',
    });

    if (!checkoutSession.url) {
      throw new Error('Stripe não retornou URL de checkout.');
    }

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (error: unknown) {
    console.error('Erro ao criar sessão de checkout da assinatura:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
