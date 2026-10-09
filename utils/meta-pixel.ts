
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

/**
 * Clique no botão de WhatsApp da vitrine. Evento padrão "Contact" da Meta (serve de conversão em campanhas
 * de tráfego/engajamento). `origem` identifica o botão; o eventID evita contar o mesmo clique em dobro.
 */
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

/**
 * Identificadores do navegador para a API de Conversões (servidor): o cookie `_fbp` e o `_fbc`.
 * Se o cliente chegou por um anúncio (parâmetro `fbclid`) e o cookie `_fbc` ainda não existe,
 * monta o valor no formato da Meta (fb.1.<timestamp>.<fbclid>).
 */
export function lerIdentificadoresMeta(): { fbp: string | null; fbc: string | null } {
  if (typeof window === 'undefined') return { fbp: null, fbc: null };
  const fbp = lerCookie('_fbp');
  let fbc = lerCookie('_fbc');
  if (!fbc) {
    try {
      const fbclid = new URLSearchParams(window.location.search).get('fbclid');
      if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
    } catch {
      // URL sem query legível: segue sem fbc.
    }
  }
  return { fbp, fbc };
}

/** Cliente abriu o produto na vitrine. Uma vez por produto por sessão da aba. */
export function trackViewContent(params: { id: string; nome: string; valor: number }) {
  if (!fbqDisponivel()) return;

  const chave = `meta_viewcontent_${params.id}`;
  try {
    if (window.sessionStorage.getItem(chave)) return;
    window.sessionStorage.setItem(chave, '1');
  } catch {
    // Sem sessionStorage: dispara mesmo assim.
  }

  window.fbq!('track', 'ViewContent', {
    content_ids: [params.id],
    content_name: params.nome,
    content_type: 'product',
    value: params.valor,
    currency: 'BRL',
  });
}
