import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/admin/cozinha';
  const redirectUrl = new URL(next, url.origin);

  if (!code) {
    const loginUrl = new URL('/login', url.origin);
    loginUrl.searchParams.set('error', 'Link de autenticação inválido ou expirado');
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL('/login', url.origin);
    console.log('Erro ao autenticar com o link recebido:', error.message);
    loginUrl.searchParams.set('error', `Não foi possível autenticar com o link recebido. ${error.message}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(redirectUrl);
}
