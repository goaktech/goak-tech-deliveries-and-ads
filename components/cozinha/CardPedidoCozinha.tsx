'use client';

import { useState } from 'react';
import type { EntregadorCozinha, PedidoCozinha } from '@/app/(dashboard)/admin/cozinha/useCozinha';
import {
  type ConfigImpressaoComanda,
  formatarDuracao,
  formatarHoraPedido,
  formatarMoedaCozinha,
  formatarTelefoneCozinha,
  imprimirComanda,
  minutosDesde,
  obterNivelAtraso,
  rotuloFormaPagamento,
  rotuloNumeroPedido,
} from '@/utils/cozinha';
import { montarUrlGeoLocalizacaoEntrega, montarUrlLocalizacaoEntrega, obterTipoEntregaPedido } from '@/utils/pedido-status';
import { montarUrlWhatsapp } from '@/utils/whatsapp';

interface CardPedidoCozinhaProps {
  pedido: PedidoCozinha;
  agora: number;
  impressao: ConfigImpressaoComanda;
  entregadores: EntregadorCozinha[];
  cancelando: boolean;
  onAvancar: (pedido: PedidoCozinha) => void;
  onCancelar: (pedido: PedidoCozinha) => void;
  onAtribuirEntregador: (pedidoId: string, entregadorId: string | null) => void;
}

const ESTILO_BOTAO_ACAO: Partial<Record<PedidoCozinha['status'], string>> = {
  PAGO: 'bg-[#1A1A1A] text-white hover:bg-black',
  PREPARANDO: 'bg-[#E16349] text-white hover:bg-[#c9533a]',
  PRONTO: 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200',
  SAIU_PARA_ENTREGA: 'bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200',
};

const ESTILO_TEMPO = {
  normal: 'bg-zinc-100 text-zinc-600',
  atencao: 'bg-amber-100 text-amber-800',
  atrasado: 'bg-red-100 text-red-800',
} as const;

function textoBotaoAcao(pedido: PedidoCozinha, ehEntrega: boolean) {
  switch (pedido.status) {
    case 'PAGO':
      return 'Iniciar preparo';
    case 'PREPARANDO':
      return 'Concluir preparo';
    case 'PRONTO':
      return ehEntrega ? 'Despachar' : 'Confirmar retirada';
    case 'SAIU_PARA_ENTREGA':
      return 'Confirmar entrega';
    default:
      return '';
  }
}

export function CardPedidoCozinha({
  pedido,
  agora,
  impressao,
  entregadores,
  cancelando,
  onAvancar,
  onCancelar,
  onAtribuirEntregador,
}: CardPedidoCozinhaProps) {
  const [enderecoCopiado, setEnderecoCopiado] = useState(false);

  const ehEntrega = obterTipoEntregaPedido(pedido.dados_cliente) === 'ENTREGA';
  const endereco = pedido.dados_cliente?.endereco;
  const observacoes = pedido.dados_cliente?.observacoes?.trim();
  const urlWhatsapp = montarUrlWhatsapp(pedido.dados_cliente?.telefone);
  const telefone = formatarTelefoneCozinha(pedido.dados_cliente?.telefone);
  const nivelAtraso = obterNivelAtraso(pedido, agora);
  const mostrarEntregador = ehEntrega && (pedido.status === 'PRONTO' || pedido.status === 'SAIU_PARA_ENTREGA');
  const textoAcao = textoBotaoAcao(pedido, ehEntrega);
  const linhaEndereco = [[endereco?.rua, endereco?.numero].filter(Boolean).join(', '), endereco?.cidade, endereco?.cep ? `CEP ${endereco.cep}` : null]
    .filter(Boolean)
    .join(' · ');

  const urlMaps = montarUrlLocalizacaoEntrega(pedido.dados_cliente, pedido.cliente_latitude, pedido.cliente_longitude);
  const urlGeo = montarUrlGeoLocalizacaoEntrega(pedido.dados_cliente, pedido.cliente_latitude, pedido.cliente_longitude);

  const copiarEndereco = async () => {
    const texto = [endereco?.bairro, linhaEndereco].filter(Boolean).join(' - ');
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setEnderecoCopiado(true);
      setTimeout(() => setEnderecoCopiado(false), 2000);
    } catch (erro) {
      console.error('Falha ao copiar endereço:', erro);
    }
  };

  const abrirNoMaps = () => {
    const ehAndroid = /android/i.test(navigator.userAgent);
    const destino = (ehAndroid ? urlGeo : urlMaps) ?? urlMaps;
    if (destino) window.open(destino, '_blank', 'noopener,noreferrer');
  };

  return (
    <article className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 text-[#1A1A1A] shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[15px] font-extrabold tracking-tight">{rotuloNumeroPedido(pedido)}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
            {ehEntrega ? (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="6" cy="17" r="2.5" />
                <circle cx="18" cy="17" r="2.5" />
                <path d="M8.5 17h7M4 13l2-5h6l3 5h4.5" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 8h12l-1 12H7L6 8z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </svg>
            )}
            {ehEntrega ? 'Entrega' : 'Retirada'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[11px] font-semibold text-zinc-400">{formatarHoraPedido(pedido.created_at, agora)}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ESTILO_TEMPO[nivelAtraso]}`}
            title={nivelAtraso === 'atrasado' ? 'Passou do tempo estimado' : 'Tempo desde o pedido'}
          >
            {formatarDuracao(minutosDesde(pedido.created_at, agora))}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-b border-zinc-100 pb-3.5">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold uppercase tracking-tight">{pedido.dados_cliente?.nome}</h3>
          {urlWhatsapp ? (
            <a href={urlWhatsapp} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-zinc-600 hover:text-[#1A1A1A]">
              {telefone}
            </a>
          ) : (
            <p className="text-[13px] font-semibold text-zinc-600">{telefone}</p>
          )}
        </div>
        {urlWhatsapp && (
          <a
            href={urlWhatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir conversa no WhatsApp com ${pedido.dados_cliente?.nome ?? 'o cliente'}`}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current" aria-hidden="true">
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.16c-.24.68-1.42 1.3-1.96 1.35-.5.05-1.13.07-1.83-.11-.42-.13-.96-.31-1.65-.6-2.9-1.25-4.8-4.17-4.94-4.37-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.66.5.24.58.83 2.01.9 2.16.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.3-.12.58.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.44.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.7-.17 1.38z" />
            </svg>
          </a>
        )}
      </div>

      <div className="flex flex-col gap-2.5 py-3.5">
        {pedido.itens_pedido.length === 0 ? (
          <p className="text-xs font-medium text-zinc-400">Carregando itens...</p>
        ) : (
          pedido.itens_pedido.map((item) => (
            <div key={item.id} className="flex items-baseline gap-2">
              <span className="min-w-6 shrink-0 text-sm font-extrabold text-[#E16349]">{item.quantidade}×</span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-snug">{item.item_cardapio.nome}</p>
                {item.adicionais.map((adicional) => (
                  <p key={adicional.id} className="text-xs font-medium text-zinc-500">
                    + {adicional.nome}
                  </p>
                ))}
              </div>
            </div>
          ))
        )}

        {observacoes && (
          <div className="mt-0.5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-xs font-semibold leading-relaxed text-amber-900">
              <span className="sr-only">Observação do cliente: </span>
              {observacoes}
            </p>
          </div>
        )}
      </div>

      {ehEntrega && endereco && (
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-bold">{endereco.bairro || 'Endereço de entrega'}</p>
            {linhaEndereco && <p className="text-[11px] leading-snug text-zinc-500">{linhaEndereco}</p>}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={copiarEndereco}
              aria-label={enderecoCopiado ? 'Endereço copiado' : 'Copiar endereço'}
              title={enderecoCopiado ? 'Copiado!' : 'Copiar endereço'}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                enderecoCopiado ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-[#1A1A1A]'
              }`}
            >
              {enderecoCopiado ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 5 5L20 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="12" height="12" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={abrirNoMaps}
              disabled={!urlMaps}
              aria-label="Abrir endereço no Maps"
              title="Abrir no Maps"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {mostrarEntregador && (
        <div className="border-t border-zinc-100 py-3">
          <label htmlFor={`entregador-${pedido.id}`} className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Entregador
          </label>
          <div className="relative mt-1">
            <select
              id={`entregador-${pedido.id}`}
              value={pedido.entregador_id ?? ''}
              onChange={(e) => onAtribuirEntregador(pedido.id, e.target.value || null)}
              className="h-10 w-full appearance-none rounded-xl border border-zinc-200 bg-white pl-3 pr-8 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 focus:border-[#E16349] focus:outline-none focus:ring-2 focus:ring-[#E16349]/20"
            >
              <option value="">Sem entregador atribuído</option>
              {entregadores.map((entregador) => (
                <option key={entregador.id} value={entregador.id}>
                  {entregador.nome}
                </option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 py-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
          <svg className="h-3 w-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 5 5L20 7" />
          </svg>
          {rotuloFormaPagamento(pedido.forma_pagamento)} · pago
        </span>
        <span className="text-sm font-extrabold">{formatarMoedaCozinha(pedido.valor_total)}</span>
      </div>

      <div className="mt-1 flex gap-2">
        {textoAcao && (
          <button
            type="button"
            onClick={() => onAvancar(pedido)}
            disabled={cancelando}
            className={`h-11 flex-1 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all duration-150 disabled:opacity-50 ${ESTILO_BOTAO_ACAO[pedido.status] ?? ''}`}
          >
            {textoAcao}
          </button>
        )}
        <button
          type="button"
          onClick={() => void imprimirComanda(pedido, impressao)}
          aria-label={`Imprimir comanda do pedido ${rotuloNumeroPedido(pedido)}`}
          title="Imprimir comanda"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:text-[#1A1A1A]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9V3h12v6" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onCancelar(pedido)}
          disabled={cancelando}
          aria-label={`${pedido.status === 'PAGO' ? 'Recusar' : 'Cancelar'} pedido ${rotuloNumeroPedido(pedido)}`}
          title={pedido.status === 'PAGO' ? 'Recusar pedido' : 'Cancelar pedido'}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        >
          {cancelando ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-transparent" aria-hidden="true" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          )}
        </button>
      </div>
    </article>
  );
}
