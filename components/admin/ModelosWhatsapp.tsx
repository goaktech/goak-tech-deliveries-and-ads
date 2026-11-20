'use client';

import { useMemo, useState, useTransition } from 'react';
import { criarModeloWhatsapp } from '@/actions/adminWhatsappConversas';
import { estilosPainel } from '@/components/shared/estilosPainel';
import type { ModeloWhatsapp } from '@/utils/whatsapp-modelos';

const ROTULO_STATUS: Record<string, string> = {
  APPROVED: 'Aprovado',
  PENDING: 'Em análise',
  REJECTED: 'Recusado',
  PAUSED: 'Pausado',
  DISABLED: 'Desativado',
};

function classeStatus(status: string) {
  if (status === 'APPROVED') return estilosPainel.seloSucesso;
  if (status === 'PENDING') return estilosPainel.seloAlerta;
  return estilosPainel.seloErro;
}

/** Modelos (templates) do número do Appetitoso: lista com status e criação de um modelo só com texto. */
export function ModelosWhatsapp({ modelos, erroLista }: { modelos: ModeloWhatsapp[]; erroLista: string | null }) {
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<'UTILITY' | 'MARKETING'>('UTILITY');
  const [corpo, setCorpo] = useState('');
  const [exemplos, setExemplos] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [pendente, startTransition] = useTransition();

  const totalVariaveis = useMemo(() => {
    const numeros = [...corpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    return numeros.length ? Math.max(...numeros) : 0;
  }, [corpo]);

  const criar = () => {
    setMensagem(null);
    startTransition(async () => {
      const resultado = await criarModeloWhatsapp({ nome, categoria, corpo, exemplos: exemplos.slice(0, totalVariaveis) });
      if (resultado.success) {
        setMensagem({ tipo: 'success', texto: 'Modelo enviado para a Meta. A aprovação costuma levar de minutos a algumas horas.' });
        setNome('');
        setCorpo('');
        setExemplos([]);
      } else {
        setMensagem({ tipo: 'error', texto: resultado.error });
      }
    });
  };

  return (
    <div className="space-y-5">
      {erroLista ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">Não foi possível ler os modelos: {erroLista}</p>
      ) : modelos.length ? (
        <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-100">
          {modelos.map((m) => (
            <li key={m.id} className="space-y-1 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-zinc-900">{m.nome}</span>
                <span className={classeStatus(m.status)}>{ROTULO_STATUS[m.status] ?? m.status}</span>
                <span className="text-xs text-zinc-500">
                  {m.categoria === 'UTILITY' ? 'Utilidade' : m.categoria === 'MARKETING' ? 'Marketing' : m.categoria} · {m.idioma}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-xs text-zinc-600">{m.corpo}</p>
              {m.motivo ? <p className="text-xs text-red-600">Motivo da recusa: {m.motivo}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">Nenhum modelo criado ainda.</p>
      )}

      <form
        className="space-y-3 rounded-2xl bg-zinc-50 p-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          criar();
        }}
      >
        <p className="text-sm font-bold text-zinc-900">Novo modelo</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="space-y-1 text-xs font-bold text-zinc-600">
            Nome (minúsculas, números e _)
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="aviso_venda_loja"
              className="block min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-normal text-zinc-900"
            />
          </label>
          <label className="space-y-1 text-xs font-bold text-zinc-600">
            Categoria
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value === 'MARKETING' ? 'MARKETING' : 'UTILITY')}
              className="block min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-normal text-zinc-900"
            >
              <option value="UTILITY">Utilidade (aviso de pedido)</option>
              <option value="MARKETING">Marketing (promoção)</option>
            </select>
          </label>
        </div>
        <label className="block space-y-1 text-xs font-bold text-zinc-600">
          Texto. Use {'{{1}}'}, {'{{2}}'}… onde entra cada dado.
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={4}
            maxLength={1024}
            placeholder={'Nova venda na {{1}}! Pedido #{{2}}, {{3}}, cliente {{4}}.'}
            className="block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900"
          />
        </label>
        {totalVariaveis > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: totalVariaveis }, (_, i) => (
              <label key={i} className="space-y-1 text-xs font-bold text-zinc-600">
                Exemplo de {`{{${i + 1}}}`}
                <input
                  value={exemplos[i] ?? ''}
                  onChange={(e) => {
                    const novos = [...exemplos];
                    novos[i] = e.target.value;
                    setExemplos(novos);
                  }}
                  className="block min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-normal text-zinc-900"
                />
              </label>
            ))}
          </div>
        ) : null}
        {mensagem ? (
          <p className={`text-xs font-medium ${mensagem.tipo === 'success' ? 'text-emerald-700' : 'text-red-600'}`} role="status">
            {mensagem.texto}
          </p>
        ) : null}
        <button type="submit" disabled={pendente || !nome.trim() || !corpo.trim()} className={estilosPainel.botaoEscuro}>
          {pendente ? 'Enviando…' : 'Enviar para aprovação'}
        </button>
      </form>
    </div>
  );
}
