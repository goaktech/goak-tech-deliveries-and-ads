import Stripe from 'stripe';

export function obterClienteStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY não configurada.');
  }

  return new Stripe(secretKey);
}

export function obterPriceIdAssinatura() {
  const priceId = process.env.STRIPE_ASSINATURA_PRICE_ID;
  if (!priceId) {
    throw new Error('STRIPE_ASSINATURA_PRICE_ID não configurada.');
  }
  return priceId;
}

export function obterWebhookSecretStripe() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET não configurada.');
  }
  return webhookSecret;
}

export function normalizarSlug(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
