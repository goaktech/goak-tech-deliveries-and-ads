// Link para abrir uma conversa de WhatsApp com o cliente a partir do telefone do pedido.

/**
 * Monta o link wa.me do telefone informado. Aceita o formato brasileiro sem DDI (DDD + número, 10 ou 11
 * dígitos), que é como o telefone é guardado no pedido, e também números que já começam com 55.
 * Retorna null se o telefone não parecer válido.
 */
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
