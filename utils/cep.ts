// Utilidades de CEP usadas no checkout (client) e na rota /api/cep (server).

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

/** 70040010 → 70040-010 (enquanto digita, devolve só o que já foi digitado). */
export function formatarCep(valor: string | null | undefined): string {
  const digitos = somenteDigitosCep(valor);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}
