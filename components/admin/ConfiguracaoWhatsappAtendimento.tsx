'use client';

import { useState } from 'react';
import { atualizarWhatsappAtendimentoLoja } from '@/actions/adminConfiguracoesLoja';
import { estilosPainel } from '@/components/shared/estilosPainel';

interface ConfiguracaoWhatsappAtendimentoProps {
  numeroInicial: string | null;
}

/** Mostra os dígitos salvos como (61) 99999-9999 para o gestor conferir. */
function formatarTelefone(digitos: string) {
  const local = digitos.startsWith('55') && digitos.length >= 12 ? digitos.slice(2) : digitos;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digitos;
}

/** WhatsApp, cenário 1: número que o cliente usa para falar com a loja a partir do acompanhamento do pedido. */
export function ConfiguracaoWhatsappAtendimento({ numeroInicial }: ConfiguracaoWhatsappAtendimentoProps) {
  const [numero, setNumero] = useState(numeroInicial ? formatarTelefone(numeroInicial) : '');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const handleSalvar = async () => {
    setSalvando(true);
    setMensagem(null);
    const resultado = await atualizarWhatsappAtendimentoLoja(numero);
    setMensagem(
      resultado.success
        ? { tipo: 'success', texto: numero.trim() ? 'WhatsApp de atendimento salvo.' : 'WhatsApp de atendimento removido.' }
        : { tipo: 'error', texto: resultado.error ?? 'Falha ao salvar.' }
    );
    setSalvando(false);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 space-y-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">WhatsApp de atendimento</div>
        <p className="mt-1 text-sm text-zinc-500">
          Aparece no acompanhamento do pedido como o botão &quot;Falar com a loja no WhatsApp&quot;, já com o número do
          pedido na mensagem. Deixe em branco para esconder o botão.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="whatsapp-atendimento" className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Número com DDD
        </label>
        <input
          id="whatsapp-atendimento"
          type="tel"
          inputMode="tel"
          placeholder="(61) 99999-9999"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none"
        />
      </div>

      {mensagem ? (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            mensagem.tipo === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      <button type="button" onClick={handleSalvar} disabled={salvando} className={estilosPainel.botaoEscuro}>
        {salvando ? 'Salvando…' : 'Salvar WhatsApp'}
      </button>
    </div>
  );
}
