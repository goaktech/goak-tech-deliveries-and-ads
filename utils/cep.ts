export interface EnderecoPorCep {
  cep: string;
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export function somenteDigitosCep(valor: string | null | undefined): string {
  return String(valor ?? '').replace(/\D/g, '').slice(0, 8);
}

export function formatarCep(valor: string | null | undefined): string {
  const digitos = somenteDigitosCep(valor);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}
