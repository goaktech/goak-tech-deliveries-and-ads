'use client';

import { useState } from 'react';
import { atualizarMetaPixelId } from '@/actions/adminPixelFacebook';

interface ConfiguracaoPixelFacebookProps {
  pixelIdInicial: string | null;
}

export function ConfiguracaoPixelFacebook({ pixelIdInicial }: ConfiguracaoPixelFacebookProps) {
  const [pixelId, setPixelId] = useState(pixelIdInicial ?? '');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const handleSalvar = async () => {
    setSalvando(true);
    setMensagem(null);

    const resultado = await atualizarMetaPixelId(pixelId.trim() || null);

    setMensagem(
      resultado.success
        ? { tipo: 'success', texto: 'Pixel do Facebook salvo com sucesso!' }
        : { tipo: 'error', texto: resultado.error ?? 'Falha ao salvar o Pixel.' }
    );
    setSalvando(false);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 space-y-3">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Meta Pixel</div>
        <div className="text-lg font-semibold text-zinc-900">Pixel do Facebook</div>
        <p className="mt-1 text-sm text-zinc-500">
          Cole o ID do Pixel para rastrear visitas, carrinho e compras da sua vitrine no Gerenciador de Eventos do Facebook.
        </p>
      </div>

      <input
        type="text"
        inputMode="numeric"
        value={pixelId}
        onChange={(e) => setPixelId(e.target.value)}
        placeholder="Ex: 123456789012345"
        className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
      />

      {mensagem ? (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            mensagem.tipo === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSalvar}
        disabled={salvando}
        className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando...' : 'Salvar Pixel'}
      </button>
    </div>
  );
}
