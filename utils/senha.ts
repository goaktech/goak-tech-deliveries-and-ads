export const TAMANHO_MINIMO_SENHA = 8;
export const TAMANHO_MAXIMO_SENHA = 72;

export interface EntradaAlterarSenha {
  senhaAtual: string;
  novaSenha: string;
  confirmacao: string;
}

export function validarAlteracaoSenha({ senhaAtual, novaSenha, confirmacao }: EntradaAlterarSenha): string | null {
  if (!senhaAtual) return 'Informe a senha atual.';
  if (novaSenha.length < TAMANHO_MINIMO_SENHA) return `A nova senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`;
  if (novaSenha.length > TAMANHO_MAXIMO_SENHA) return `A nova senha pode ter no máximo ${TAMANHO_MAXIMO_SENHA} caracteres.`;
  if (novaSenha === senhaAtual) return 'A nova senha precisa ser diferente da senha atual.';
  if (novaSenha !== confirmacao) return 'A confirmação não é igual à nova senha.';
  return null;
}
