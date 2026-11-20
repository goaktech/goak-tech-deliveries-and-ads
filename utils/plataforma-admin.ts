import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';

/**
 * Equipe Appetitoso (dona do número de WhatsApp da plataforma). Ainda não existe papel de
 * administrador da plataforma no banco: por enquanto vale a lista de e-mails em
 * PLATAFORMA_ADMIN_EMAILS (separados por vírgula). Sem a variável, ninguém é admin da plataforma.
 */
export const ehAdminPlataforma = cache(async (): Promise<boolean> => {
  const permitidos = (process.env.PLATAFORMA_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!permitidos.length) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return Boolean(email && permitidos.includes(email));
});
