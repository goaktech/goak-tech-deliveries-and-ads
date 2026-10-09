/** Só os dígitos do telefone, sem o 55 do Brasil quando vier colado com ele. */
export function somenteDigitosTelefone(valor: string) {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2, 13) : digitos.slice(0, 11);
}

/** (11) 99999-9999 ou (11) 3333-4444, formatando enquanto a pessoa digita. */
export function formatarTelefone(valor: string) {
  const d = somenteDigitosTelefone(valor);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Telefone brasileiro válido: DDD (11–99) + 8 ou 9 dígitos (celular começa com 9). */
export function telefoneValido(valor: string) {
  const d = somenteDigitosTelefone(valor);
  if (d.length < 10 || d.length > 11) return false;
  if (Number(d.slice(0, 2)) < 11) return false;
  if (d.length === 11 && d[2] !== '9') return false;
  return true;
}

/** Nome com pelo menos 2 letras (aceita um nome só: o pedido é entregue por WhatsApp). */
export function nomeValido(valor: string) {
  return (valor.match(/\p{L}/gu) ?? []).length >= 2;
}
