'use client';

import { useState } from 'react';
import { removerMetaCapi, salvarMetaCapi } from '@/actions/adminMetaCapi';

interface ConfiguracaoMetaCapiProps {
  temPixel: boolean;
  configurado: boolean;
  codigoTesteInicial: string | null;
}

// O token nunca volta para o navegador: o campo começa vazio e só mostra se existe um token salvo.
export function ConfiguracaoMetaCapi({ temPixel, configurado, codigoTesteInicial }: ConfiguracaoMetaCapiProps) {
  const [token, setToken] = useState('');
  const [codigoTeste, setCodigoTeste] = useState(codigoTesteInicial ?? '');
  const [salvo, setSalvo] = useState(configurado);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const handleSalvar = async () => {
    setOcupado(true);
    setMensagem(null);
    const resultado = await salvarMetaCapi({ token, codigoTeste: codigoTeste || null });
    if (resultado.success) {
      setSalvo(true);
      setToken('');
      setMensagem({ tipo: 'success', texto: 'Token validado e salvo. As compras passam a ser enviadas também pelo servidor.' });
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error ?? 'Falha ao salvar o token.' });
    }
    setOcupado(false);
  };

  const handleRemover = async () => {
    setOcupado(true);
    setMensagem(null);
    const resultado = await removerMetaCapi();
    if (resultado.success) {
      setSalvo(false);
      setToken('');
      setMensagem({ tipo: 'success', texto: 'Token removido. Voltamos a enviar apenas pelo Pixel do navegador.' });
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error ?? 'Falha ao remover o token.' });
    }
    setOcupado(false);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Meta API de Conversões</div>
          <div className="text-lg font-semibold text-zinc-900">Envio das compras pelo servidor</div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
            salvo ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-50 text-zinc-500'
          }`}
        >
          {salvo ? 'Ativa' : 'Opcional'}
        </span>
      </div>

      <p className="text-sm text-zinc-500">
        Opcional. Sem o token, as compras vão só pelo Pixel do navegador e algumas se perdem (bloqueadores de anúncio, iPhone, cliente que
        fecha a página depois de pagar). Com o token, o Appetitoso avisa a Meta também pelo servidor, sem duplicar a compra.
      </p>

      {!temPixel ? (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Salve o ID do Pixel abaixo antes de cadastrar o token.
        </div>
      ) : null}

      <details className="text-sm text-zinc-600">
        <summary className="cursor-pointer font-semibold text-zinc-800">Onde gero o token?</summary>
        <p className="mt-2">
          Gerenciador de Eventos &gt; seu Pixel &gt; Configurações &gt; API de Conversões &gt; <strong>Gerar token de acesso</strong>.
          Cole o token completo aqui.
        </p>
      </details>

      <input
        type="password"
        autoComplete="off"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder={salvo ? 'Token salvo. Cole um novo para trocar' : 'Cole o token de acesso'}
        className="w-full min-w-0 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
      />

      <details className="text-sm text-zinc-600">
        <summary className="cursor-pointer font-semibold text-zinc-800">Código de teste (opcional)</summary>
        <p className="mt-2">
          Para testar sem afetar os dados reais, cole o código da aba &quot;Eventos de teste&quot; do Pixel (ex.: TEST12345). Apague depois do teste.
        </p>
        <input
          type="text"
          value={codigoTeste}
          onChange={(e) => setCodigoTeste(e.target.value)}
          placeholder="TEST12345"
          className="mt-2 w-full min-w-0 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
        />
      </details>

      {mensagem ? (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            mensagem.tipo === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSalvar}
          disabled={ocupado || !temPixel || token.trim().length === 0}
          className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {ocupado ? 'Aguarde...' : 'Validar e salvar'}
        </button>
        {salvo ? (
          <button
            type="button"
            onClick={handleRemover}
            disabled={ocupado}
            className="rounded-xl border border-zinc-200 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-zinc-700 disabled:opacity-50"
          >
            Remover token
          </button>
        ) : null}
      </div>
    </div>
  );
}
