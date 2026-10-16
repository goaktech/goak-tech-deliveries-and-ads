export function somenteDigitosTelefone(valor: string) {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2, 13) : digitos.slice(0, 11);
}

export function formatarTelefone(valor: string) {
  const d = somenteDigitosTelefone(valor);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function telefoneValido(valor: string) {
  const d = somenteDigitosTelefone(valor);
  if (d.length < 10 || d.length > 11) return false;
  if (Number(d.slice(0, 2)) < 11) return false;
  if (d.length === 11 && d[2] !== '9') return false;
  return true;
}

export function nomeValido(valor: string) {
  return (valor.match(/\p{L}/gu) ?? []).length >= 2;
}
