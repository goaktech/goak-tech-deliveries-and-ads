'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password || !email.includes('@')) {
    return redirect('/login?error=Informe e-mail e senha válidos')
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect(`/login?error=${encodeURIComponent('Credenciais inválidas')}`)
  }

  return redirect('/admin/cozinha')
}

export async function solicitarLinkMagico(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!email || !email.includes('@')) {
    return redirect('/login?error=Informe um e-mail válido para receber o link');
  }

  if (!appUrl) {
    return redirect('/login?error=URL pública da aplicação não configurada');
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${appUrl}/auth/callback?next=/admin/cozinha`,
    },
  });

  if (error) {
    console.log('Não foi possível enviar o link mágico:', error.message);
    return redirect(`/login?error=${encodeURIComponent('Não foi possível enviar o link mágico. ' + error.message)}`);
  }

  return redirect('/login?status=link-magico-enviado');
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(`Falha ao encerrar sessão: ${error.message}`);
  }

  return redirect('/login');
}
