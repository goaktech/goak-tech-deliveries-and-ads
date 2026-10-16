
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

export function trackContatoWhatsApp(params: { origem: string }) {
  if (!fbqDisponivel()) return;

  window.fbq!(
    'track',
    'Contact',
    { content_name: 'WhatsApp', contact_method: 'whatsapp', origem: params.origem },
    { eventID: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }
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

function lerCookie(nome: string): string | null {
  if (typeof document === 'undefined') return null;
  const par = document.cookie.split('; ').find((linha) => linha.startsWith(`${nome}=`));
  return par ? decodeURIComponent(par.slice(nome.length + 1)) : null;
}

export function lerIdentificadoresMeta(): { fbp: string | null; fbc: string | null } {
  if (typeof window === 'undefined') return { fbp: null, fbc: null };
  const fbp = lerCookie('_fbp');
  let fbc = lerCookie('_fbc');
  if (!fbc) {
    try {
      const fbclid = new URLSearchParams(window.location.search).get('fbclid');
      if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
    } catch {
    }
  }
  return { fbp, fbc };
}

export function trackViewContent(params: { id: string; nome: string; valor: number }) {
  if (!fbqDisponivel()) return;

  const chave = `meta_viewcontent_${params.id}`;
  try {
    if (window.sessionStorage.getItem(chave)) return;
    window.sessionStorage.setItem(chave, '1');
  } catch {
  }

  window.fbq!('track', 'ViewContent', {
    content_ids: [params.id],
    content_name: params.nome,
    content_type: 'product',
    value: params.valor,
    currency: 'BRL',
  });
}
