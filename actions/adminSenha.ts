'use server';

import { createClient as criarClienteSupabase } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { validarAlteracaoSenha, type EntradaAlterarSenha } from '@/utils/senha';

export interface ResultadoAlterarSenha {
  success: boolean;
  error?: string;
}

export async function alterarSenhaGestor(entrada: EntradaAlterarSenha): Promise<ResultadoAlterarSenha> {
  const dados: EntradaAlterarSenha = {
    senhaAtual: String(entrada?.senhaAtual ?? ''),
    novaSenha: String(entrada?.novaSenha ?? ''),
    confirmacao: String(entrada?.confirmacao ?? ''),
  };

  const erroValidacao = validarAlteracaoSenha(dados);
  if (erroValidacao) return { success: false, error: erroValidacao };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { success: false, error: 'Sua sessão expirou. Entre novamente para alterar a senha.' };
  }

  const verificador = criarClienteSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { error: erroSenhaAtual } = await verificador.auth.signInWithPassword({
    email: user.email,
    password: dados.senhaAtual,
  });

  if (erroSenhaAtual) {
    if (erroSenhaAtual.status === 429) {
      return { success: false, error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' };
    }
    if (erroSenhaAtual.code === 'invalid_credentials' || erroSenhaAtual.status === 400) {
      return { success: false, error: 'A senha atual está incorreta.' };
    }
    console.error('Falha ao confirmar a senha atual:', erroSenhaAtual.message);
    return { success: false, error: 'Não foi possível confirmar a senha atual. Tente novamente.' };
  }

  const { error: erroAtualizacao } = await supabase.auth.updateUser({ password: dados.novaSenha });

  if (erroAtualizacao) {
    if (erroAtualizacao.code === 'same_password') {
      return { success: false, error: 'A nova senha precisa ser diferente da senha atual.' };
    }
    if (erroAtualizacao.code === 'weak_password') {
      return { success: false, error: 'Essa senha é fraca demais. Escolha uma senha mais difícil de adivinhar.' };
    }
    console.error('Falha ao alterar a senha:', erroAtualizacao.message);
    return { success: false, error: 'Não foi possível alterar a senha. Tente novamente.' };
  }

  try {
    await supabase.auth.signOut({ scope: 'others' });
  } catch (erro) {
    console.error('Falha ao encerrar as outras sessões:', erro instanceof Error ? erro.message : erro);
  }

  return { success: true };
}
