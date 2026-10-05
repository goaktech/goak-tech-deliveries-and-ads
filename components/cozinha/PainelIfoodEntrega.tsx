'use client';

import { useEffect, useState } from 'react';
import type { CotacaoIfoodCozinha, PedidoCozinha } from '@/app/(dashboard)/admin/cozinha/useCozinha';
import { formatarMoedaCozinha } from '@/utils/cozinha';

interface PainelIfoodEntregaProps {
  pedido: PedidoCozinha;
  onAtualizado: () => void;
}

type Resposta = { error?: string; cotacao?: CotacaoIfoodCozinha; motivos?: Array<{ codigo: string; descricao: string }>; valido?: boolean };

// Rótulos dos eventos do iFood que a cozinha vê enquanto a entrega acontece.
const ROTULO_STATUS_IFOOD: Record<string, string> = {
  REGISTRADO: 'Entrega solicitada ao iFood',
  PLACED: 'Entrega solicitada ao iFood',
  CONFIRMED: 'iFood procurando entregador',
  PREPARATION_STARTED: 'Em preparo — iFood avisado',
  READY_TO_PICKUP: 'Pronto — aguardando o entregador',
  DELIVERY_ADDRESS_CHANGE_REQUESTED: 'Cliente pediu outro endereço',
  DELIVERY_ADDRESS_CHANGE_ACCEPTED: 'Endereço novo aceito',
  DELIVERY_ADDRESS_CHANGE_DENIED: 'Endereço novo recusado',
  DELIVERY_ADDRESS_CHANGE_USER_CONFIRMED: 'Cliente confirmou o endereço',
  ASSIGN_DRIVER: 'Entregador a caminho da loja',
  GOING_TO_ORIGIN: 'Entregador a caminho da loja',
  ARRIVED_AT_ORIGIN: 'Entregador na loja — peça o código de coleta',
  DELIVERY_PICKUP_CODE_REQUESTED: 'Entregador na loja — peça o código de coleta',
  COLLECTED: 'Pedido coletado',
  DISPATCHED: 'Saiu para entrega',
  DELIVERY_IN_TRANSIT: 'Saiu para entrega',
  ARRIVED_AT_DESTINATION: 'Entregador chegou no cliente',
  DELIVERY_DROP_CODE_REQUESTED: 'Entregador pedindo o código ao cliente',
  CONCLUDED: 'Entregue',
  DELIVERY_CONCLUDED: 'Entregue',
  CANCELAMENTO_SOLICITADO: 'Cancelamento solicitado ao iFood',
  CANCELLATION_REQUEST_FAILED: 'O iFood não aceitou o cancelamento',
};

// Cotação feita no checkout (loja com "Entregas pelo iFood") ainda dentro da validade.
function cotacaoDoCheckout(pedido: PedidoCozinha): CotacaoIfoodCozinha | null {
  const cotacao = pedido.ifood_cotacao;
  if (!cotacao?.id || typeof cotacao.taxaCobradaCliente !== 'number') return null;
  if (cotacao.expiraEm && new Date(cotacao.expiraEm).getTime() <= Date.now() + 30_000) return null;
  return cotacao;
}

// Distância em metros entre dois pontos (haversine).
function distanciaMetros(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (grau: number) => (grau * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(h)));
}

// O iFood recusa sozinho a alteração de endereço 15 min depois do pedido do cliente.
const PRAZO_ALTERACAO_ENDERECO_MS = 15 * 60 * 1000;

const BOTAO = 'h-9 rounded-xl px-3 text-[11px] font-bold uppercase tracking-wide transition disabled:opacity-50';
const BOTAO_PRIMARIO = `${BOTAO} bg-[#EA1D2C] text-white hover:bg-[#c8101e]`;
const BOTAO_SECUNDARIO = `${BOTAO} border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300`;

export function PainelIfoodEntrega({ pedido, onAtualizado }: PainelIfoodEntregaProps) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cotacao, setCotacao] = useState<CotacaoIfoodCozinha | null>(() => cotacaoDoCheckout(pedido));
  const taxaCobradaCliente = typeof pedido.ifood_cotacao?.taxaCobradaCliente === 'number' ? pedido.ifood_cotacao.taxaCobradaCliente : null;
  const [motivos, setMotivos] = useState<Array<{ codigo: string; descricao: string }> | null>(null);
  const [motivoEscolhido, setMotivoEscolhido] = useState('');
  const [codigoColeta, setCodigoColeta] = useState('');

  const comIfood = pedido.logistica === 'IFOOD';
  const alteracao = pedido.ifood_alteracao_endereco;
  const alteracaoPendente = alteracao?.estado === 'PENDENTE';

  // relógio do prazo da alteração de endereço (só roda enquanto está pendente)
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!alteracaoPendente) return;
    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [alteracaoPendente]);

  // Modo homologação (IFOOD_HOMOLOGACAO=true): código de coleta dos detalhes do
  // pedido e eventos recebidos, para o vídeo do cenário 4. Fora desse modo a
  // API responde 403 e nada aparece.
  const [homologacao, setHomologacao] = useState<{
    pickupCode: string | null;
    eventos: Array<{ codigo: string; recebidoEm: string }>;
  } | null>(null);
  useEffect(() => {
    if (!comIfood) return;
    let ativo = true;
    fetch(`/api/admin/pedidos/${pedido.id}/ifood`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ acao: 'homologacao' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((dados) => {
        if (ativo && dados) setHomologacao(dados);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [comIfood, pedido.id, pedido.ifood_status]);
  const codigoSolicitado = homologacao?.eventos.some((e) => e.codigo === 'DELIVERY_PICKUP_CODE_REQUESTED') ?? false;

  const enderecoAtual = pedido.dados_cliente?.endereco;
  const coordenadaNova = alteracao?.endereco?.coordinates;
  const distanciaAlteracao =
    pedido.cliente_latitude !== null &&
    pedido.cliente_longitude !== null &&
    typeof coordenadaNova?.latitude === 'number' &&
    typeof coordenadaNova?.longitude === 'number'
      ? distanciaMetros(
          { latitude: pedido.cliente_latitude, longitude: pedido.cliente_longitude },
          { latitude: coordenadaNova.latitude, longitude: coordenadaNova.longitude }
        )
      : null;
  const restanteAlteracaoMs = alteracao?.solicitadoEm
    ? Math.max(0, new Date(alteracao.solicitadoEm).getTime() + PRAZO_ALTERACAO_ENDERECO_MS - agora)
    : null;

  const chamar = async (corpo: Record<string, unknown>): Promise<Resposta | null> => {
    setCarregando(true);
    setErro(null);
    setInfo(null);
    try {
      const resposta = await fetch(`/api/admin/pedidos/${pedido.id}/ifood`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const dados = (await resposta.json().catch(() => ({}))) as Resposta;
      if (!resposta.ok) {
        setErro(dados.error || 'Não foi possível falar com o iFood.');
        return null;
      }
      return dados;
    } catch {
      setErro('Sem conexão. Nada foi alterado.');
      return null;
    } finally {
      setCarregando(false);
    }
  };

  // ------------------------------------------------ antes de chamar o iFood
  if (!comIfood) {
    return (
      <div className="mt-2 space-y-2">
        {pedido.ifood_status === 'CANCELLED' || pedido.ifood_status === 'DELIVERY_CANCELLED' ? (
          <p className="text-[11px] font-semibold text-amber-700">A entrega pelo iFood foi cancelada. Escolha outro entregador.</p>
        ) : null}

        {!cotacao ? (
          <button
            type="button"
            disabled={carregando}
            onClick={async () => {
              const dados = await chamar({ acao: 'cotar' });
              if (dados?.cotacao) setCotacao(dados.cotacao);
            }}
            className={`${BOTAO_SECUNDARIO} w-full border-[#EA1D2C]/30 text-[#EA1D2C]`}
          >
            {carregando ? 'Consultando…' : 'Entregador iFood'}
          </button>
        ) : (
          <div className="space-y-2 rounded-xl border border-red-100 bg-red-50/60 p-3 text-xs text-zinc-700">
            <div className="font-bold text-zinc-900">Entregador iFood disponível</div>
            <div>
              Taxa: <b>{formatarMoedaCozinha(cotacao.valor)}</b> (cobrada da loja pelo iFood) · {(cotacao.distanciaMetros / 1000).toFixed(1)} km ·{' '}
              {cotacao.tempoMinimoMin}–{cotacao.tempoMaximoMin} min
            </div>
            {taxaCobradaCliente !== null ? (
              <div className="text-[11px] text-zinc-500">
                O cliente já pagou {formatarMoedaCozinha(taxaCobradaCliente)} de entrega no checkout.
              </div>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={carregando}
                onClick={async () => {
                  const dados = await chamar({ acao: 'chamar', cotacao });
                  if (dados) {
                    setCotacao(null);
                    onAtualizado();
                  }
                }}
                className={`${BOTAO_PRIMARIO} flex-1`}
              >
                {carregando ? 'Chamando…' : 'Confirmar'}
              </button>
              <button type="button" disabled={carregando} onClick={() => setCotacao(null)} className={BOTAO_SECUNDARIO}>
                Voltar
              </button>
            </div>
          </div>
        )}
        {erro ? <p className="text-[11px] font-semibold text-red-600">{erro}</p> : null}
      </div>
    );
  }

  // ------------------------------------------------ entrega em andamento no iFood
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-[#EA1D2C]">
          iFood · {ROTULO_STATUS_IFOOD[pedido.ifood_status ?? ''] ?? pedido.ifood_status ?? 'Entrega solicitada'}
        </span>
        {pedido.ifood_tracking_url ? (
          <a href={pedido.ifood_tracking_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-zinc-500 underline">
            Rastreio
          </a>
        ) : null}
      </div>

      {alteracao && !alteracaoPendente ? (
        <p className={`text-[11px] font-semibold ${alteracao.estado === 'DENIED' ? 'text-zinc-500' : 'text-emerald-700'}`}>
          {alteracao.estado === 'ACCEPTED'
            ? 'Alteração de endereço aceita — o entregador vai para o endereço novo.'
            : alteracao.estado === 'DENIED'
              ? 'Alteração de endereço recusada — entrega no endereço original.'
              : alteracao.estado === 'USER_CONFIRMED'
                ? 'O cliente confirmou o endereço original.'
                : alteracao.estado === 'ACEITANDO' || alteracao.estado === 'REJEITANDO'
                  ? 'Resposta enviada ao iFood — aguardando confirmação.'
                : `Alteração de endereço: ${alteracao.estado}`}
        </p>
      ) : null}

      {pedido.ifood_entregador?.nome ? (
        <p className="text-xs text-zinc-600">
          Entregador: <b>{pedido.ifood_entregador.nome}</b>
          {pedido.ifood_entregador.telefone ? ` · ${pedido.ifood_entregador.telefone}` : ''}
        </p>
      ) : null}

      {alteracaoPendente ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-zinc-700">
          <div className="font-bold text-amber-900">O cliente pediu outro endereço</div>
          {enderecoAtual ? (
            <div>
              <span className="text-zinc-500">Atual: </span>
              {[enderecoAtual.rua, enderecoAtual.numero, enderecoAtual.bairro, enderecoAtual.cidade].filter(Boolean).join(', ')}
            </div>
          ) : null}
          {alteracao.endereco ? (
            <div>
              <span className="text-zinc-500">Novo: </span>
              <b>
                {[alteracao.endereco.streetName, alteracao.endereco.streetNumber, alteracao.endereco.neighborhood, alteracao.endereco.city]
                  .filter(Boolean)
                  .join(', ')}
              </b>
              {distanciaAlteracao !== null ? <span className="text-zinc-500"> · {distanciaAlteracao} m do original</span> : null}
            </div>
          ) : null}
          <div className="text-[11px] text-amber-800">
            {restanteAlteracaoMs !== null
              ? `Responda em ${Math.floor(restanteAlteracaoMs / 60000)} min ${Math.floor((restanteAlteracaoMs % 60000) / 1000)} s — depois disso o iFood recusa sozinho.`
              : 'Responda em até 15 minutos — depois disso o iFood recusa sozinho.'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={carregando}
              onClick={async () => {
                if (await chamar({ acao: 'endereco', aceitar: true })) onAtualizado();
              }}
              className={`${BOTAO_PRIMARIO} flex-1 bg-emerald-600 hover:bg-emerald-700`}
            >
              Aceitar
            </button>
            <button
              type="button"
              disabled={carregando}
              onClick={async () => {
                if (await chamar({ acao: 'endereco', aceitar: false })) onAtualizado();
              }}
              className={`${BOTAO_SECUNDARIO} flex-1`}
            >
              Recusar
            </button>
          </div>
        </div>
      ) : null}

      {homologacao ? (
        <div className="space-y-1.5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-2.5 font-mono text-[10.5px] text-zinc-600">
          <div className="font-sans text-[10px] font-bold uppercase tracking-wider text-zinc-400">Homologação · código de coleta</div>
          <div>
            pickupCode nos detalhes do pedido (GET /order/v1.0/orders/&#123;id&#125;):{' '}
            <b className="text-zinc-900">{homologacao.pickupCode ?? '—'}</b>
          </div>
          <div>
            evento DELIVERY_PICKUP_CODE_REQUESTED:{' '}
            <b className={codigoSolicitado ? 'text-emerald-700' : 'text-amber-700'}>{codigoSolicitado ? 'recebido' : 'não recebido'}</b>
          </div>
          <div className="leading-relaxed">
            eventos:{' '}
            {homologacao.eventos.length
              ? homologacao.eventos
                  .map((e) => `${new Date(e.recebidoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ${e.codigo}`)
                  .join(' · ')
              : '—'}
          </div>
        </div>
      ) : null}

      <form
        className="flex gap-2"
        onSubmit={async (evento) => {
          evento.preventDefault();
          const dados = await chamar({ acao: 'coleta', codigo: codigoColeta });
          if (dados?.valido) {
            setInfo('Código válido: pode entregar o pedido ao entregador.');
            setCodigoColeta('');
          } else if (dados) {
            setErro('Código inválido: não entregue o pedido.');
          }
          // erro de API (ex.: HTTP 400) já vem em `erro` por chamar(); no modo
          // homologação, explica a limitação da loja de teste.
          if (!dados && homologacao && !codigoSolicitado) {
            setInfo('Na loja de teste a exigência do código de coleta não está ativa: o iFood não enviou DELIVERY_PICKUP_CODE_REQUESTED.');
          }
        }}
      >
        <input
          value={codigoColeta}
          onChange={(evento) => setCodigoColeta(evento.target.value)}
          placeholder="Código de coleta do entregador"
          inputMode="numeric"
          className="h-9 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 text-xs font-semibold focus:border-[#EA1D2C] focus:outline-none"
        />
        <button type="submit" disabled={carregando || !codigoColeta.trim()} className={BOTAO_SECUNDARIO}>
          Validar
        </button>
      </form>

      {motivos === null ? (
        <button
          type="button"
          disabled={carregando || pedido.ifood_status === 'CANCELAMENTO_SOLICITADO'}
          onClick={async () => {
            const dados = await chamar({ acao: 'motivos' });
            if (!dados) return;
            if (!dados.motivos?.length) {
              setErro('O iFood não permite mais cancelar esta entrega.');
              return;
            }
            setMotivos(dados.motivos);
            setMotivoEscolhido(dados.motivos[0].codigo);
          }}
          className="text-[11px] font-semibold text-zinc-500 underline disabled:opacity-50"
        >
          Cancelar entrega pelo iFood
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400" htmlFor={`motivo-ifood-${pedido.id}`}>
            Motivo (lista do iFood)
          </label>
          <select
            id={`motivo-ifood-${pedido.id}`}
            value={motivoEscolhido}
            onChange={(evento) => setMotivoEscolhido(evento.target.value)}
            className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-2 text-xs font-semibold"
          >
            {motivos.map((motivo) => (
              <option key={motivo.codigo} value={motivo.codigo}>
                {motivo.descricao}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={carregando}
              onClick={async () => {
                const descricao = motivos.find((motivo) => motivo.codigo === motivoEscolhido)?.descricao ?? '';
                if (await chamar({ acao: 'cancelar', codigo: motivoEscolhido, descricao })) {
                  setMotivos(null);
                  onAtualizado();
                }
              }}
              className={`${BOTAO_PRIMARIO} flex-1`}
            >
              Confirmar cancelamento
            </button>
            <button type="button" disabled={carregando} onClick={() => setMotivos(null)} className={BOTAO_SECUNDARIO}>
              Voltar
            </button>
          </div>
        </div>
      )}

      {info ? <p className="text-[11px] font-semibold text-emerald-700">{info}</p> : null}
      {erro ? <p className="text-[11px] font-semibold text-red-600">{erro}</p> : null}
    </div>
  );
}
