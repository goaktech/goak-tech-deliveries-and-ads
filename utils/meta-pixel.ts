
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
