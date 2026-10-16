export type FormaPagamentoLoja = 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO';

export const FORMAS_PAGAMENTO_LOJA: FormaPagamentoLoja[] = ['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'];

export const FORMAS_PAGAMENTO_PADRAO: FormaPagamentoLoja[] = ['PIX'];

export const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamentoLoja, string> = {
  PIX: 'PIX',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
};

export function ehFormaPagamentoLoja(valor: unknown): valor is FormaPagamentoLoja {
  return typeof valor === 'string' && (FORMAS_PAGAMENTO_LOJA as string[]).includes(valor);
}

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

export function aceitaCartaoCredito(formas: FormaPagamentoLoja[]): boolean {
  return formas.includes('CARTAO_CREDITO');
}

export function aceitaCartaoDebito(formas: FormaPagamentoLoja[]): boolean {
  return formas.includes('CARTAO_DEBITO');
}

export function rotuloBotaoCartao(formas: FormaPagamentoLoja[]): string {
  return formas.includes('CARTAO_CREDITO') ? ROTULO_FORMA_PAGAMENTO.CARTAO_CREDITO : 'Cartão';
}

export function tiposMercadoPagoExcluidos(formas: FormaPagamentoLoja[]): Array<{ id: string }> {
  const excluidos = new Set<string>(['ticket', 'atm', 'bank_transfer', 'prepaid_card']);
  if (!formas.includes('CARTAO_CREDITO')) excluidos.add('credit_card');
  if (!formas.includes('CARTAO_DEBITO')) excluidos.add('debit_card');
  return Array.from(excluidos).map((id) => ({ id }));
}
