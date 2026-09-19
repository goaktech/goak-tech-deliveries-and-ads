'use client';

import { useState } from 'react';
import { atualizarFormasPagamentoLoja } from '@/actions/adminConfiguracoesLoja';
import {
  FORMAS_PAGAMENTO_LOJA,
  ROTULO_FORMA_PAGAMENTO,
  normalizarFormasPagamento,
  type FormaPagamentoLoja,
} from '@/utils/formas-pagamento';

interface ConfiguracaoFormasPagamentoProps {
  formasIniciais: string[] | null | undefined;
}

const DESCRICAO_FORMA: Record<FormaPagamentoLoja, string> = {
  PIX: 'QR Code e copia e cola gerados na hora, direto no checkout da loja.',
  CARTAO_CREDITO: 'O cliente conclui o pagamento na página segura do Mercado Pago.',
  CARTAO_DEBITO: 'O cliente conclui o pagamento na página segura do Mercado Pago.',
};

export function ConfiguracaoFormasPagamento({ formasIniciais }: ConfiguracaoFormasPagamentoProps) {
  const [salvas, setSalvas] = useState<FormaPagamentoLoja[]>(() => normalizarFormasPagamento(formasIniciais));
  const [escolhidas, setEscolhidas] = useState<FormaPagamentoLoja[]>(salvas);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const alterado = FORMAS_PAGAMENTO_LOJA.some((forma) => escolhidas.includes(forma) !== salvas.includes(forma));

  const alternar = (forma: FormaPagamentoLoja) => {
    setMensagem(null);
    setEscolhidas((atuais) => (atuais.includes(forma) ? atuais.filter((item) => item !== forma) : [...atuais, forma]));
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setMensagem(null);

    const resultado = await atualizarFormasPagamentoLoja(escolhidas);

    if (resultado.success && resultado.formas) {
      setSalvas(resultado.formas);
      setEscolhidas(resultado.formas);
      setMensagem({ tipo: 'success', texto: 'Formas de pagamento salvas! O checkout da loja já está atualizado.' });
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error ?? 'Falha ao salvar as formas de pagamento.' });
    }
    setSalvando(false);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 space-y-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Formas de pagamento da loja</div>
        <p className="mt-1 text-sm text-zinc-500">
          Escolha o que seus clientes podem usar no checkout. Todas dependem da conta do Mercado Pago conectada acima.
        </p>
      </div>

      <div className="grid gap-2.5">
        {FORMAS_PAGAMENTO_LOJA.map((forma) => {
          const marcada = escolhidas.includes(forma);
          return (
            <label
              key={forma}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                marcada ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 bg-white hover:bg-zinc-50'
              }`}
            >
              <input
                type="checkbox"
                checked={marcada}
                onChange={() => alternar(forma)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-semibold text-zinc-900">{ROTULO_FORMA_PAGAMENTO[forma]}</span>
                <span className="block text-xs text-zinc-500">{DESCRICAO_FORMA[forma]}</span>
              </span>
            </label>
          );
        })}
      </div>

      {escolhidas.length === 0 ? (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Escolha pelo menos uma forma de pagamento.
        </div>
      ) : null}

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
        disabled={salvando || escolhidas.length === 0 || !alterado}
        className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando...' : 'Salvar formas de pagamento'}
      </button>
    </div>
  );
}
