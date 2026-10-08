
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function fbqDisponivel(): boolean {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
}

export function trackAddToCart(params: {
  id: string;
  nome: string;
  valor: number;
  quantidade: number;
}) {
  if (!fbqDisponivel()) return;

  window.fbq!('track', 'AddToCart', {
    content_ids: [params.id],
    content_name: params.nome,
    content_type: 'product',
    value: params.valor * params.quantidade,
    currency: 'BRL',
  });
}

export function trackInitiateCheckout(params: {
  itens: Array<{ id: string; quantidade: number }>;
  valorTotal: number;
}) {
  if (!fbqDisponivel()) return;

  window.fbq!('track', 'InitiateCheckout', {
    content_ids: params.itens.map((item) => item.id),
    contents: params.itens.map((item) => ({ id: item.id, quantity: item.quantidade })),
    value: params.valorTotal,
    currency: 'BRL',
  });
}

/**
 * Cliente informou o pagamento: gerou o PIX ou enviou os dados do cartão.
 * Evento padrão da Meta (AddPaymentInfo). Não é compra: o Purchase só sai com pagamento confirmado.
 */
export function trackAddPaymentInfo(params: {
  metodo: 'pix' | 'cartao';
  valorTotal: number;
  itens: Array<{ id: string; quantidade: number }>;
}) {
  if (!fbqDisponivel()) return;

  window.fbq!('track', 'AddPaymentInfo', {
    content_ids: params.itens.map((item) => item.id),
    contents: params.itens.map((item) => ({ id: item.id, quantity: item.quantidade })),
    payment_method: params.metodo,
    value: params.valorTotal,
    currency: 'BRL',
  });
}

/**
 * Purchase só para pagamento confirmado. Dispara no máximo uma vez por pedido neste navegador
 * (o `eventID` = id do pedido também deduplica com o evento enviado pelo servidor).
 */
export function trackPurchaseUmaVez(params: {
  pedidoId: string;
  valorTotal: number;
  itens: Array<{ id: string; quantidade: number }>;
}): boolean {
  if (!fbqDisponivel()) return false;

  const chave = `meta_purchase_${params.pedidoId}`;
  try {
    if (window.localStorage.getItem(chave)) return false;
    window.localStorage.setItem(chave, new Date().toISOString());
  } catch {
    // Sem localStorage: segue sem a trava local (a deduplicação pelo eventID continua valendo).
  }

  trackPurchase(params);
  return true;
}

export function trackPurchase(params: {
  pedidoId: string;
  valorTotal: number;
  itens: Array<{ id: string; quantidade: number }>;
}) {
  if (!fbqDisponivel()) return;

  window.fbq!(
    'track',
    'Purchase',
    {
      content_ids: params.itens.map((item) => item.id),
      contents: params.itens.map((item) => ({ id: item.id, quantity: item.quantidade })),
      value: params.valorTotal,
      currency: 'BRL',
    },
    { eventID: params.pedidoId }
  );
}

export function trackClicouPagarPix(params: {
  valorTotal: number;
  itens: Array<{ id: string; quantidade: number }>;
}) {
  if (!fbqDisponivel()) return;

  window.fbq!('trackCustom', 'ClicouPagarPix', {
    content_ids: params.itens.map((item) => item.id),
    contents: params.itens.map((item) => ({ id: item.id, quantity: item.quantidade })),
    value: params.valorTotal,
    currency: 'BRL',
  });
}
