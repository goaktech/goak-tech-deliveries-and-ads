'use client';

import { useState, type FormEvent } from 'react';
import { alterarSenhaGestor } from '@/actions/adminSenha';
import { TAMANHO_MINIMO_SENHA, validarAlteracaoSenha } from '@/utils/senha';
import { estilosPainel } from '@/components/shared/estilosPainel';

interface MensagemSenha {
  tipo: 'success' | 'error';
  texto: string;
}

const CLASSE_CAMPO =
  'w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none';
const CLASSE_ROTULO = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-500';

export function ConfiguracaoSenha() {
  const [aberto, setAberto] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<MensagemSenha | null>(null);

  const limparCampos = () => {
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmacao('');
    setMostrar(false);
  };

  const handleAbrir = () => {
    setMensagem(null);
    setAberto(true);
  };

  const handleCancelar = () => {
    limparCampos();
    setMensagem(null);
    setAberto(false);
  };

  const handleSubmit = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (salvando) return;

    const erroLocal = validarAlteracaoSenha({ senhaAtual, novaSenha, confirmacao });
    if (erroLocal) {
      setMensagem({ tipo: 'error', texto: erroLocal });
      return;
    }

    setSalvando(true);
    setMensagem(null);

    try {
      const resultado = await alterarSenhaGestor({ senhaAtual, novaSenha, confirmacao });
      if (resultado.success) {
        limparCampos();
        setAberto(false);
        setMensagem({ tipo: 'success', texto: 'Senha alterada com sucesso.' });
      } else {
        setMensagem({ tipo: 'error', texto: resultado.error ?? 'Não foi possível alterar a senha.' });
      }
    } catch {
      setMensagem({ tipo: 'error', texto: 'Não foi possível alterar a senha. Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  };

  const tipoCampo = mostrar ? 'text' : 'password';

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 p-5">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Segurança</div>
        <p className="mt-1 text-sm text-zinc-500">
          Altere a senha de acesso ao painel. Ao trocar, as outras sessões abertas com a sua conta são encerradas.
        </p>
      </div>

      {mensagem ? (
        <div
          role={mensagem.tipo === 'error' ? 'alert' : 'status'}
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            mensagem.tipo === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      {aberto ? (
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="space-y-1">
            <label htmlFor="senha-atual" className={CLASSE_ROTULO}>
              Senha atual
            </label>
            <input
              id="senha-atual"
              type={tipoCampo}
              autoComplete="current-password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              disabled={salvando}
              className={CLASSE_CAMPO}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="nova-senha" className={CLASSE_ROTULO}>
              Nova senha
            </label>
            <input
              id="nova-senha"
              type={tipoCampo}
              autoComplete="new-password"
              minLength={TAMANHO_MINIMO_SENHA}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              disabled={salvando}
              aria-describedby="nova-senha-ajuda"
              className={CLASSE_CAMPO}
            />
            <p id="nova-senha-ajuda" className="text-[11px] text-zinc-400">
              Use pelo menos {TAMANHO_MINIMO_SENHA} caracteres.
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="confirmar-senha" className={CLASSE_ROTULO}>
              Confirmar nova senha
            </label>
            <input
              id="confirmar-senha"
              type={tipoCampo}
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              disabled={salvando}
              className={CLASSE_CAMPO}
            />
          </div>

          <label className="flex min-h-11 items-center gap-2 text-xs font-medium text-zinc-600 sm:min-h-0">
            <input
              type="checkbox"
              checked={mostrar}
              onChange={(e) => setMostrar(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Mostrar senhas
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={salvando} className={estilosPainel.botaoEscuro}>
              {salvando ? 'Salvando...' : 'Salvar nova senha'}
            </button>
            <button type="button" onClick={handleCancelar} disabled={salvando} className={estilosPainel.botaoSecundario}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={handleAbrir} className={estilosPainel.botaoEscuro}>
          Alterar senha
        </button>
      )}
    </div>
  );
}
