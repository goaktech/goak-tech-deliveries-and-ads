'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatarNumeroPedido } from '@/utils/pedido-status';

export interface PagamentoEstornavel {
  id: string;
  pedidoId: string;
  paymentId: string;
  status: string;
  valor: number;
  valorEstornado: number;
  duplicado: boolean;
  criadoEm: string;
  numeroPedido: number | null;
  statusPedido: string;
  formaPagamento: string;
  clienteNome: string;
}

export interface EstornoHistorico {
  id: string;
  pedidoId: string;
  numeroPedido: number | null;
  valor: number;
  tipo: string;
  motivo: string;
  status: string;
  erro: string | null;
  cancelouPedido: boolean;
  criadoEm: string;
}

const MOTIVOS = [
  'Cliente desistiu',
  'Item indisponível',
  'Pedido entregue com problema',
  'Cobrança duplicada',
  'Outro',
];

const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const rotulo = (numero: number | null, id: string) => `#${formatarNumeroPedido(numero, id)}`;
const STATUS_TERMINAIS = ['CANCELADO', 'ENTREGUE'];

export function ListaEstornosAdmin({
  pagamentos,
  estornos,
}: {
  pagamentos: PagamentoEstornavel[];
  estornos: EstornoHistorico[];
}) {
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <div className="grid gap-6 md:grid-cols-2 md:items-start">
      <div className="min-w-0 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Pagamentos aprovados</h2>
        {pagamentos.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
            Nenhum pagamento aprovado registrado ainda.
          </p>
        ) : (
          pagamentos.map((pagamento) => (
            <CartaoPagamento
              key={pagamento.id}
              pagamento={pagamento}
              aberto={aberto === pagamento.id}
              onAlternar={() => setAberto(aberto === pagamento.id ? null : pagamento.id)}
            />
          ))
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Histórico de estornos</h2>
        {estornos.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
            Nenhum estorno realizado.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
            {estornos.map((estorno) => (
              <li key={estorno.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div className="space-y-0.5">
                  <div className="font-semibold text-zinc-900">
                    Pedido {rotulo(estorno.numeroPedido, estorno.pedidoId)} · {moeda(estorno.valor)}{' '}
                    <span className="text-xs font-bold uppercase text-zinc-400">{estorno.tipo}</span>
                  </div>
                  <div className="text-zinc-500">
                    {estorno.motivo || 'Sem motivo'} · {data(estorno.criadoEm)}
                    {estorno.cancelouPedido ? ' · pedido cancelado' : ''}
                  </div>
                  {estorno.erro ? <div className="text-xs text-red-600">{estorno.erro}</div> : null}
                </div>
                <span
                  className={
                    estorno.status === 'CONCLUIDO'
                      ? 'rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600'
                      : 'rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-600'
                  }
                >
                  {estorno.status === 'CONCLUIDO' ? 'Concluído' : 'Falhou'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CartaoPagamento({
  pagamento,
  aberto,
  onAlternar,
}: {
  pagamento: PagamentoEstornavel;
  aberto: boolean;
  onAlternar: () => void;
}) {
  const disponivel = Math.max(0, Math.round((pagamento.valor - pagamento.valorEstornado) * 100) / 100);
  const totalmenteEstornado = disponivel <= 0;

  return (
    <div className="rounded-2xl border border-zinc-200 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-zinc-900">
            Pedido {rotulo(pagamento.numeroPedido, pagamento.pedidoId)}
            {pagamento.clienteNome ? ` · ${pagamento.clienteNome}` : ''}
          </div>
          <div className="text-sm text-zinc-500">
            {pagamento.formaPagamento || 'Pagamento online'} · {data(pagamento.criadoEm)} · Mercado Pago #
            {pagamento.paymentId}
          </div>
          <div className="text-sm text-zinc-700">
            Pago {moeda(pagamento.valor)}
            {pagamento.valorEstornado > 0 ? ` · estornado ${moeda(pagamento.valorEstornado)}` : ''}
            {pagamento.duplicado ? ' · duplicado' : ''}
          </div>
        </div>
        {totalmenteEstornado ? (
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Estornado
          </span>
        ) : (
          <button
            type="button"
            onClick={onAlternar}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white hover:bg-zinc-700 transition-colors"
          >
            {aberto ? 'Fechar' : 'Estornar'}
          </button>
        )}
      </div>
      {aberto && !totalmenteEstornado ? (
        <FormularioEstorno
          key={`${pagamento.id}-${pagamento.valorEstornado}`}
          pagamento={pagamento}
          disponivel={disponivel}
          onConcluido={onAlternar}
        />
      ) : null}
    </div>
  );
}

function FormularioEstorno({
  pagamento,
  disponivel,
  onConcluido,
}: {
  pagamento: PagamentoEstornavel;
  disponivel: number;
  onConcluido: () => void;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<'TOTAL' | 'PARCIAL'>('TOTAL');
  const [valorTexto, setValorTexto] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [outroMotivo, setOutroMotivo] = useState('');
  const podeCancelar = !STATUS_TERMINAIS.includes(pagamento.statusPedido);
  const [cancelarPedido, setCancelarPedido] = useState(podeCancelar);
  const [token] = useState(() => crypto.randomUUID());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const valorParcial = Number(valorTexto.replace(/\./g, '').replace(',', '.'));
  const valorFinal = tipo === 'TOTAL' ? disponivel : valorParcial;
  const motivoFinal = motivo === 'Outro' ? outroMotivo.trim() : motivo;
  const valido =
    motivoFinal.length > 0 &&
    Number.isFinite(valorFinal) &&
    valorFinal > 0 &&
    valorFinal <= disponivel + 0.001 &&
    !enviando;

  const confirmar = async () => {
    if (!valido) return;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch('/api/admin/estornos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pedidoId: pagamento.pedidoId,
          paymentId: pagamento.paymentId,
          ...(tipo === 'PARCIAL' ? { valor: valorFinal } : {}),
          motivo: motivoFinal,
          cancelarPedido: podeCancelar && cancelarPedido,
          token,
        }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        throw new Error(corpo?.error || 'Falha ao processar o estorno.');
      }
      if (corpo?.avisoCancelamento) {
        setAviso(`Estorno concluído, mas o pedido não foi cancelado: ${corpo.avisoCancelamento}`);
      }
      router.refresh();
      if (!corpo?.avisoCancelamento) {
        onConcluido();
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao processar o estorno.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl bg-zinc-50 p-4">
      <div className="flex gap-2">
        {(['TOTAL', 'PARCIAL'] as const).map((opcao) => (
          <button
            key={opcao}
            type="button"
            onClick={() => setTipo(opcao)}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
              tipo === opcao ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 border border-zinc-200'
            }`}
          >
            {opcao === 'TOTAL' ? `Total (${moeda(disponivel)})` : 'Parcial'}
          </button>
        ))}
      </div>

      {tipo === 'PARCIAL' ? (
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-zinc-700">Valor a estornar (máx. {moeda(disponivel)})</span>
          <input
            inputMode="decimal"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            placeholder="0,00"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 outline-none focus:border-zinc-900"
          />
        </label>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span className="font-semibold text-zinc-700">Motivo</span>
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 outline-none focus:border-zinc-900"
        >
          {MOTIVOS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      {motivo === 'Outro' ? (
        <input
          value={outroMotivo}
          onChange={(e) => setOutroMotivo(e.target.value)}
          maxLength={150}
          placeholder="Descreva o motivo"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
      ) : null}

      {podeCancelar ? (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={cancelarPedido} onChange={(e) => setCancelarPedido(e.target.checked)} />
          Cancelar também o pedido (para a cozinha)
        </label>
      ) : null}

      {erro ? <p className="text-sm font-semibold text-red-600">{erro}</p> : null}
      {aviso ? <p className="text-sm font-semibold text-amber-600">{aviso}</p> : null}

      <button
        type="button"
        onClick={confirmar}
        disabled={!valido}
        className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? 'Estornando…' : `Confirmar estorno de ${Number.isFinite(valorFinal) && valorFinal > 0 ? moeda(valorFinal) : '—'}`}
      </button>
      <p className="text-xs text-zinc-400">Esta ação não pode ser desfeita.</p>
    </div>
  );
}
