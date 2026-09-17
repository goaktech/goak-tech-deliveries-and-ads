'use client';

import React, { useState } from 'react';
import { EntregadorCozinha, PedidoCozinha } from '@/app/(dashboard)/admin/cozinha/useCozinha';
import { montarUrlGeoLocalizacaoEntrega, montarUrlLocalizacaoEntrega } from '@/utils/pedido-status';

interface CardPedidoCozinhaProps {
  pedido: PedidoCozinha;
  onAvancarStatus: (pedidoId: string, novoStatus: PedidoCozinha['status']) => void;
  isMutating: boolean;
  entregadores: EntregadorCozinha[];
  onAtribuirEntregador: (pedidoId: string, entregadorId: string | null) => void;
}

export function CardPedidoCozinha({
  pedido,
  onAvancarStatus,
  isMutating,
  entregadores,
  onAtribuirEntregador,
}: CardPedidoCozinhaProps) {
  const ehEntrega = pedido.dados_cliente?.tipoEntrega !== 'RETIRADA';
  const mostrarAtribuicaoEntregador =
    ehEntrega && (pedido.status === 'PRONTO' || pedido.status === 'SAIU_PARA_ENTREGA');
  const endereco = pedido.dados_cliente?.endereco;

  const [mostrarEndereco, setMostrarEndereco] = useState(false);
  const [enderecoCopiado, setEnderecoCopiado] = useState(false);

  const formatarEndereco = (end?: typeof endereco) => {
    if (!end) return '';
    return [
      [end.rua, end.numero].filter(Boolean).join(', '),
      end.bairro,
      end.cidade,
      end.cep ? `CEP ${end.cep}` : null,
    ]
      .filter(Boolean)
      .join(' - ');
  };

  const copiarEndereco = async () => {
    const texto = formatarEndereco(endereco);
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setEnderecoCopiado(true);
      setTimeout(() => setEnderecoCopiado(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar endereço:', err);
    }
  };

  const urlMapsLocalizacao = montarUrlLocalizacaoEntrega(
    pedido.dados_cliente,
    pedido.cliente_latitude,
    pedido.cliente_longitude
  );
  const urlGeoLocalizacao = montarUrlGeoLocalizacaoEntrega(
    pedido.dados_cliente,
    pedido.cliente_latitude,
    pedido.cliente_longitude
  );

  // No Android, "geo:" abre o seletor nativo de apps (Maps, Waze etc). No iPhone e no
  // computador esse esquema não é reconhecido, então usamos o link do Google Maps.
  // A checagem do aparelho só é feita no clique (evento do usuário), nunca durante a
  // renderização, então não há risco de diferença entre o HTML do servidor e o do cliente.
  const abrirLocalizacaoNoMaps = () => {
    const ehAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    const href = (ehAndroid ? urlGeoLocalizacao : urlMapsLocalizacao) ?? urlMapsLocalizacao;
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  const obterProximoStatus = (statusAtual: PedidoCozinha['status']): PedidoCozinha['status'] | null => {
    switch (statusAtual) {
      case 'PENDENTE':
      case 'PAGO':
        return 'PREPARANDO';
      case 'PREPARANDO':
        return 'PRONTO';
      case 'PRONTO':
        return ehEntrega ? 'SAIU_PARA_ENTREGA' : 'ENTREGUE';
      case 'SAIU_PARA_ENTREGA':
        return 'ENTREGUE';
      default:
        return null;
    }
  };

  const proximoStatus = obterProximoStatus(pedido.status);

  const obterEstiloBotaoAcao = (statusAtual: PedidoCozinha['status']): string => {
    switch (statusAtual) {
      case 'PENDENTE':
      case 'PAGO':
        return 'bg-[#1A1A1A] text-white hover:bg-black';
      case 'PREPARANDO':
        return 'bg-[#E16349] text-white hover:bg-[#c9533a]';
      case 'PRONTO':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200';
      case 'SAIU_PARA_ENTREGA':
        return 'bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200';
      default:
        return 'bg-zinc-100 text-zinc-400 cursor-not-allowed';
    }
  };

  const obterTextoBotao = (statusAtual: PedidoCozinha['status']): string => {
    switch (statusAtual) {
      case 'PENDENTE':
        return 'Aceitar Pedido';
      case 'PAGO':
        return 'Iniciar Preparo';
      case 'PREPARANDO':
        return 'Concluir Preparo';
      case 'PRONTO':
        return ehEntrega ? 'Despachar' : 'Confirmar Retirada';
      case 'SAIU_PARA_ENTREGA':
        return 'Confirmar Entrega';
      default:
        return 'Finalizado';
    }
  };

  const formatarHora = (dataString: string) => {
    try {
      const data = new Date(dataString);
      return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 text-[#1A1A1A] shadow-sm select-none">
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[10px] font-mono font-semibold tracking-wider text-zinc-500">
            #{pedido.id.substring(0, 8).toUpperCase()}
          </span>
          <span className="text-xs font-semibold text-zinc-500">
            {formatarHora(pedido.created_at)}
          </span>
        </div>

        <div className="mb-3 border-b border-zinc-100 pb-2">
          <h3 className="text-base font-bold tracking-tight text-[#1A1A1A] uppercase">{pedido.dados_cliente?.nome}</h3>
          <p className="mt-0.5 text-sm font-bold text-zinc-700">{pedido.dados_cliente?.telefone}</p>
        </div>

        <div className="mb-3 border-b border-zinc-100 pb-2.5">
          <span className="inline-block rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
            descrição
          </span>
          <div className="mt-2 space-y-2.5">
            {pedido.itens_pedido.map((item) => (
              <div key={item.id} className="text-sm">
                <div className="flex items-start justify-between">
                  <span className="text-[#1A1A1A] font-bold leading-tight">
                    {item.item_cardapio.nome}
                  </span>
                  <span className="ml-4 rounded border border-zinc-200 bg-[#F3F3F3] px-2 py-0.5 text-xs font-mono font-bold text-zinc-700">
                    {item.quantidade}x
                  </span>
                </div>
                {item.adicionais.length > 0 && (
                  <p className="mt-0.5 text-xs font-medium text-[#E16349]">
                    + {item.adicionais.map((adicional) => adicional.nome).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {ehEntrega && endereco && (
          <div className="mb-3 border-b border-zinc-100 pb-2.5">
            <button
              type="button"
              onClick={() => setMostrarEndereco((atual) => !atual)}
              className="w-full rounded-md border border-zinc-100 py-1 text-[9px] font-medium lowercase tracking-wide text-zinc-500 transition hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-700"
            >
              {mostrarEndereco ? 'Ocultar endereço' : 'Ver endereço'}
            </button>
            {mostrarEndereco && (
              <p className="mt-2 text-[11px] font-medium leading-snug text-zinc-600">
                {formatarEndereco(endereco)}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-1">
              <button
                type="button"
                onClick={copiarEndereco}
                className={`flex-1 rounded-md border py-1 text-[9px] font-medium lowercase tracking-wide transition ${
                  enderecoCopiado
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-zinc-100 text-zinc-500 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-700'
                }`}
              >
                {enderecoCopiado ? 'Copiado!' : 'Copiar endereço'}
              </button>
              <button
                type="button"
                onClick={abrirLocalizacaoNoMaps}
                disabled={!urlMapsLocalizacao}
                title={urlMapsLocalizacao ?? undefined}
                className="flex-1 rounded-md border border-zinc-100 py-1 text-[9px] font-medium lowercase tracking-wide text-zinc-500 transition hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Abrir no Maps
              </button>
            </div>
          </div>
        )}

      </div>

      {mostrarAtribuicaoEntregador && (
        <div className="mt-3 border-t border-zinc-100 pt-3">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Entregador</label>
          <div className="relative mt-1">
            <select
              value={pedido.entregador_id ?? ''}
              onChange={(e) => onAtribuirEntregador(pedido.id, e.target.value || null)}
              className="w-full appearance-none rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-8 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 focus:border-[#E16349] focus:outline-none focus:ring-2 focus:ring-[#E16349]/20"
            >
              <option value="">Sem entregador atribuído</option>
              {entregadores.map((entregador) => (
                <option key={entregador.id} value={entregador.id}>
                  {entregador.nome}
                </option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-zinc-100">
        {proximoStatus ? (
          <button
            onClick={() => onAvancarStatus(pedido.id, proximoStatus)}
            disabled={isMutating}
            className={`w-full rounded-xl py-2 text-xs font-semibold tracking-wide uppercase transition-all duration-150 disabled:opacity-50 ${obterEstiloBotaoAcao(pedido.status)}`}
          >
            {isMutating ? 'Processando...' : obterTextoBotao(pedido.status)}
          </button>
        ) : (
          <div className="w-full rounded-xl bg-zinc-100 py-2 text-center text-xs font-semibold tracking-wide text-zinc-400 uppercase">
            Despachado
          </div>
        )}
      </div>
    </div>
  );
}
