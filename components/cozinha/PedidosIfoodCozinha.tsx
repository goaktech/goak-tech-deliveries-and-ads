'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PedidoIfoodCozinha, StatusPedidoIfood } from '@/utils/ifood-pedidos';

const INTERVALO_LISTA_MS = 10000;

const ROTULO_STATUS: Record<StatusPedidoIfood, string> = {
  PLACED: 'Novo — aguardando confirmação',
  CONFIRMED: 'Confirmado',
  PREPARATION_STARTED: 'Em preparo',
  READY_TO_PICKUP: 'Pronto para retirada',
  DISPATCHED: 'Despachado',
  CONCLUDED: 'Concluído',
  CANCELLATION_REQUESTED: 'Cancelamento solicitado',
  CANCELLED: 'Cancelado',
};

const CLASSE_STATUS: Record<StatusPedidoIfood, string> = {
  PLACED: 'border-amber-200 bg-amber-50 text-amber-700',
  CONFIRMED: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  PREPARATION_STARTED: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  READY_TO_PICKUP: 'border-sky-100 bg-sky-50 text-sky-700',
  DISPATCHED: 'border-sky-100 bg-sky-50 text-sky-700',
  CONCLUDED: 'border-zinc-200 bg-zinc-100 text-zinc-600',
  CANCELLATION_REQUESTED: 'border-red-100 bg-red-50 text-red-700',
  CANCELLED: 'border-red-100 bg-red-50 text-red-700',
};

const ROTULO_TIPO: Record<string, string> = { DELIVERY: 'Entrega', TAKEOUT: 'Retirada', INDOOR: 'No local' };

const EM_ANDAMENTO: StatusPedidoIfood[] = ['CONFIRMED', 'PREPARATION_STARTED', 'READY_TO_PICKUP'];

interface Motivo {
  codigo: string;
  descricao: string;
}

const BOTAO = 'rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50';
const BOTAO_PRIMARIO = `${BOTAO} bg-[#1A1A1A] text-white`;
const BOTAO_SECUNDARIO = `${BOTAO} border border-zinc-200 bg-white text-zinc-700`;

export function PedidosIfoodCozinha() {
  const [pedidos, setPedidos] = useState<PedidoIfoodCozinha[]>([]);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [erro, setErro] = useState<{ id: string; texto: string } | null>(null);
  const [cancelando, setCancelando] = useState<{ id: string; motivos: Motivo[]; codigo: string } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch('/api/admin/ifood/pedidos', { cache: 'no-store' });
      const corpo = (await resposta.json()) as { pedidos?: PedidoIfoodCozinha[] };
      setPedidos(corpo.pedidos ?? []);
    } catch {
    }
  }, []);

  useEffect(() => {
    const primeira = setTimeout(() => void carregar(), 0);
    const intervalo = setInterval(() => void carregar(), INTERVALO_LISTA_MS);
    return () => {
      clearTimeout(primeira);
      clearInterval(intervalo);
    };
  }, [carregar]);

  const chamar = async (id: string, corpo: Record<string, string>) => {
    setOcupadoId(id);
    setErro(null);
    try {
      const resposta = await fetch(`/api/admin/ifood/pedidos/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const dados = (await resposta.json().catch(() => ({}))) as { error?: string; motivos?: Motivo[] };
      if (!resposta.ok) {
        throw new Error(dados.error ?? 'Falha ao falar com o iFood.');
      }
      return dados;
    } catch (falha) {
      setErro({ id, texto: falha instanceof Error ? falha.message : 'Falha ao falar com o iFood.' });
      return null;
    } finally {
      setOcupadoId(null);
    }
  };

  const executar = async (id: string, acao: 'confirmar' | 'pronto' | 'despachar') => {
    if (await chamar(id, { acao })) await carregar();
  };

  const abrirCancelamento = async (id: string) => {
    const dados = await chamar(id, { acao: 'motivos' });
    if (!dados) return;
    const motivos = dados.motivos ?? [];
    if (motivos.length === 0) {
      setErro({ id, texto: 'O iFood não permite cancelar este pedido agora.' });
      return;
    }
    setCancelando({ id, motivos, codigo: motivos[0].codigo });
  };

  const confirmarCancelamento = async () => {
    if (!cancelando) return;
    const motivo = cancelando.motivos.find((m) => m.codigo === cancelando.codigo);
    const dados = await chamar(cancelando.id, {
      acao: 'cancelar',
      codigo: cancelando.codigo,
      descricao: motivo?.descricao ?? '',
    });
    if (dados) {
      setCancelando(null);
      await carregar();
    }
  };

  if (pedidos.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-[#EA1D2C]">Pedidos do iFood ({pedidos.length})</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {pedidos.map((pedido) => {
          const ocupado = ocupadoId === pedido.id;
          const emAndamento = EM_ANDAMENTO.includes(pedido.status);
          return (
            <article key={pedido.id} className="space-y-2 rounded-xl border border-zinc-200 p-3 text-sm text-zinc-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-zinc-900">
                  #{pedido.numero ?? pedido.id.slice(0, 8)} · {pedido.clienteNome ?? 'Cliente iFood'}
                </b>
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${CLASSE_STATUS[pedido.status]}`}>
                  {ROTULO_STATUS[pedido.status]}
                </span>
              </div>
              <div className="text-xs text-zinc-500">
                {ROTULO_TIPO[pedido.tipo ?? ''] ?? pedido.tipo ?? 'Pedido'}
                {pedido.entregaPor ? ` · entrega ${pedido.entregaPor === 'IFOOD' ? 'pelo iFood' : 'pela loja'}` : ''}
                {pedido.total != null ? ` · R$ ${pedido.total.toFixed(2).replace('.', ',')}` : ''}
                {` · ${new Date(pedido.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              </div>
              <ul className="space-y-0.5">
                {pedido.itens.map((item, indice) => (
                  <li key={indice}>
                    {item.quantidade}x {item.nome}
                    {item.opcoes.length > 0 ? <span className="text-xs text-zinc-500"> ({item.opcoes.join(', ')})</span> : null}
                    {item.observacoes ? <span className="block text-xs text-amber-700">Obs.: {item.observacoes}</span> : null}
                  </li>
                ))}
              </ul>
              {pedido.endereco ? <div className="text-xs text-zinc-500">{pedido.endereco}</div> : null}
              {pedido.observacoes ? <div className="text-xs text-amber-700">Obs. da entrega: {pedido.observacoes}</div> : null}
              <div className="font-mono text-[10px] text-zinc-400">
                {pedido.id} · último evento: {pedido.ultimoEvento ?? '—'}
              </div>

              {erro?.id === pedido.id ? (
                <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {erro.texto}
                </div>
              ) : null}

              {cancelando?.id === pedido.id ? (
                <div className="space-y-2 rounded-xl border border-red-100 bg-red-50 p-3">
                  <label className="block text-xs font-medium text-zinc-700">
                    Motivo do cancelamento
                    <select
                      value={cancelando.codigo}
                      onChange={(e) => setCancelando({ ...cancelando, codigo: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                    >
                      {cancelando.motivos.map((motivo) => (
                        <option key={motivo.codigo} value={motivo.codigo}>
                          {motivo.descricao}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={ocupado} onClick={() => void confirmarCancelamento()} className={`${BOTAO} bg-red-700 text-white`}>
                      Confirmar cancelamento
                    </button>
                    <button type="button" disabled={ocupado} onClick={() => setCancelando(null)} className={BOTAO_SECUNDARIO}>
                      Voltar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pedido.status === 'PLACED' ? (
                    <button type="button" disabled={ocupado} onClick={() => void executar(pedido.id, 'confirmar')} className={BOTAO_PRIMARIO}>
                      Confirmar pedido
                    </button>
                  ) : null}
                  {emAndamento && pedido.status !== 'READY_TO_PICKUP' ? (
                    <button type="button" disabled={ocupado} onClick={() => void executar(pedido.id, 'pronto')} className={BOTAO_SECUNDARIO}>
                      Pronto
                    </button>
                  ) : null}
                  {emAndamento && pedido.tipo === 'DELIVERY' ? (
                    <button type="button" disabled={ocupado} onClick={() => void executar(pedido.id, 'despachar')} className={BOTAO_PRIMARIO}>
                      Despachar
                    </button>
                  ) : null}
                  {pedido.status === 'PLACED' || emAndamento ? (
                    <button type="button" disabled={ocupado} onClick={() => void abrirCancelamento(pedido.id)} className={BOTAO_SECUNDARIO}>
                      Cancelar
                    </button>
                  ) : null}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
