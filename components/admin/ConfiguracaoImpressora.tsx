'use client';

import { useState } from 'react';
import { atualizarLarguraPapelImpressaoLoja } from '@/actions/adminConfiguracoesLoja';
import { type LarguraPapelImpressao, LARGURAS_PAPEL_IMPRESSAO } from '@/utils/impressao';

interface ConfiguracaoImpressoraProps {
  larguraInicial: LarguraPapelImpressao;
}

const DESCRICAO_LARGURA: Record<LarguraPapelImpressao, string> = {
  58: 'Impressoras térmicas compactas, portáteis ou Bluetooth.',
  80: 'Impressoras térmicas de balcão, mais comuns em cozinhas.',
};

export function ConfiguracaoImpressora({ larguraInicial }: ConfiguracaoImpressoraProps) {
  const [largura, setLargura] = useState<LarguraPapelImpressao>(larguraInicial);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const handleSalvar = async () => {
    setSalvando(true);
    setMensagem(null);
    const resultado = await atualizarLarguraPapelImpressaoLoja(largura);
    setMensagem(
      resultado.success
        ? { tipo: 'success', texto: 'Largura do papel salva com sucesso!' }
        : { tipo: 'error', texto: resultado.error ?? 'Falha ao salvar a largura do papel.' }
    );
    setSalvando(false);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 space-y-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Impressora de comandas</div>
        <p className="mt-1 text-sm text-zinc-500">
          Escolha a largura do papel da sua impressora térmica. A comanda impressa no painel da cozinha segue esse tamanho.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Largura do papel">
        {LARGURAS_PAPEL_IMPRESSAO.map((opcao) => {
          const ativa = opcao === largura;
          return (
            <button
              key={opcao}
              type="button"
              role="radio"
              aria-checked={ativa}
              onClick={() => setLargura(opcao)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                ativa ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300'
              }`}
            >
              <div className="text-sm font-bold">{opcao} mm</div>
              <div className={`mt-0.5 text-[11px] ${ativa ? 'text-zinc-300' : 'text-zinc-500'}`}>{DESCRICAO_LARGURA[opcao]}</div>
            </button>
          );
        })}
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

      <button
        type="button"
        onClick={handleSalvar}
        disabled={salvando || largura === larguraInicial}
        className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  );
}
