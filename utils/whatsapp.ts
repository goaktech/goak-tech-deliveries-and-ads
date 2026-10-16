export function montarUrlWhatsapp(telefone?: string | null): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '');
  if (!digitos) return null;

  let numero = digitos;
  if (numero.length === 10 || numero.length === 11) {
    numero = `55${numero}`;
  } else if (!((numero.length === 12 || numero.length === 13) && numero.startsWith('55'))) {
    return null;
  }

  return `https://wa.me/${numero}`;
}

export function montarUrlWhatsappComMensagem(numeroLoja: string | null | undefined, mensagem: string): string | null {
  const base = montarUrlWhatsapp(numeroLoja);
  if (!base) return null;
  return `${base}?text=${encodeURIComponent(mensagem)}`;
}
