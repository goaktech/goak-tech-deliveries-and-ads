// Formas de pagamento que cada loja aceita no checkout.
// Configuradas pelo gestor em /admin/integracoes e guardadas em
// `restaurantes.formas_pagamento_aceitas` (text[]).
//
// - PIX             → QR Code / copia e cola gerado direto pela API de pagamentos do Mercado Pago.
// - CARTAO_CREDITO  → checkout do Mercado Pago (Checkout Pro), somente cartão de crédito.
// - CARTAO_DEBITO   → checkout do Mercado Pago (Checkout Pro), somente cartão de débito.
// Se a loja aceitar crédito e débito, os dois aparecem no mesmo checkout do Mercado Pago.

export type FormaPagamentoLoja = 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO';

export const FORMAS_PAGAMENTO_LOJA: FormaPagamentoLoja[] = ['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'];

/** Padrão de toda loja (comportamento anterior à configuração: só PIX). */
export const FORMAS_PAGAMENTO_PADRAO: FormaPagamentoLoja[] = ['PIX'];

export const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamentoLoja, string> = {
  PIX: 'PIX',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
};

export function ehFormaPagamentoLoja(valor: unknown): valor is FormaPagamentoLoja {
  return typeof valor === 'string' && (FORMAS_PAGAMENTO_LOJA as string[]).includes(valor);
}

/**
 * Converte o valor cru do banco (ou de um formulário) numa lista válida, sem
 * repetição e na ordem PIX → crédito → débito. Vazio/inválido cai no padrão.
 */
export function normalizarFormasPagamento(valor: unknown): FormaPagamentoLoja[] {
  if (!Array.isArray(valor)) return [...FORMAS_PAGAMENTO_PADRAO];
  const escolhidas = FORMAS_PAGAMENTO_LOJA.filter((forma) => valor.includes(forma));
  return escolhidas.length > 0 ? escolhidas : [...FORMAS_PAGAMENTO_PADRAO];
}

export function aceitaPix(formas: FormaPagamentoLoja[]): boolean {
  return formas.includes('PIX');
}

export function aceitaCartao(formas: FormaPagamentoLoja[]): boolean {
  return formas.includes('CARTAO_CREDITO') || formas.includes('CARTAO_DEBITO');
}

/** Texto do botão de cartão no checkout, conforme o que a loja aceita. */
export function rotuloBotaoCartao(formas: FormaPagamentoLoja[]): string {
  const credito = formas.includes('CARTAO_CREDITO');
  const debito = formas.includes('CARTAO_DEBITO');
  if (credito && debito) return 'Cartão de crédito ou débito';
  return credito ? ROTULO_FORMA_PAGAMENTO.CARTAO_CREDITO : ROTULO_FORMA_PAGAMENTO.CARTAO_DEBITO;
}

/**
 * Tipos de pagamento que o checkout do Mercado Pago deve esconder para que só
 * apareçam as formas de cartão que a loja aceita. PIX é tratado à parte
 * (fluxo próprio), então também fica de fora do checkout de cartão.
 */
export function tiposMercadoPagoExcluidos(formas: FormaPagamentoLoja[]): Array<{ id: string }> {
  const excluidos = new Set<string>(['ticket', 'atm', 'bank_transfer', 'prepaid_card']);
  if (!formas.includes('CARTAO_CREDITO')) excluidos.add('credit_card');
  if (!formas.includes('CARTAO_DEBITO')) excluidos.add('debit_card');
  return Array.from(excluidos).map((id) => ({ id }));
}
