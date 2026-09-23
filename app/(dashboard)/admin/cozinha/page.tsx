'use client';

import { useMemo, useState } from 'react';
import { type PedidoCozinha, useCozinha } from './useCozinha';
import { BarraNavegacaoCozinha } from '@/components/cozinha/BarraNavegacaoCozinha';
import { ColunaEsteiraCozinha } from '@/components/cozinha/ColunaEsteiraCozinha';
import { FaixaPedidosPendentes } from '@/components/cozinha/FaixaPedidosPendentes';
import { ListaPedidosFinalizados } from '@/components/cozinha/ListaPedidosFinalizados';
import { ModalCancelarPedido } from '@/components/cozinha/ModalCancelarPedido';
import { AvisoCozinha } from '@/components/cozinha/AvisoCozinha';
import { formatarNumeroPedido } from '@/utils/pedido-status';

type EtapaCozinha = 'novos' | 'preparo' | 'prontos' | 'caminho' | 'finalizados';

function normalizarTexto(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function pedidoCorrespondeBusca(pedido: PedidoCozinha, busca: string) {
  const termo = normalizarTexto(busca.replace(/^#/, ''));
  if (!termo) return true;
  const digitos = termo.replace(/\D/g, '');
  const numero = formatarNumeroPedido(pedido.numero_pedido, pedido.id).toLowerCase();
  const telefone = String(pedido.dados_cliente?.telefone ?? '').replace(/\D/g, '');
  const nome = normalizarTexto(pedido.dados_cliente?.nome ?? '');
  if (nome.includes(termo) || numero.includes(termo)) return true;
  if (digitos.length >= 4 && telefone.includes(digitos)) return true;
  return digitos.length > 0 && String(pedido.numero_pedido ?? '') === String(Number(digitos));
}

const ROTULO_CONEXAO = {
  conectando: 'Conectando',
  online: 'Em tempo real',
  offline: 'Reconectar',
} as const;

export default function PainelCozinhaAdmin() {
  const {
    pedidos,
    entregadores,
    nomeLoja,
    loading,
    sincronizando,
    conexao,
    aviso,
    agora,
    somLigado,
    audioBloqueado,
    cancelandoIds,
    sincronizar,
    alternarSom,
    liberarSom,
    avancarPedido,
    desfazer,
    fecharAviso,
    cancelarPedido,
    atribuirEntregador,
  } = useCozinha();

  const [etapaAtiva, setEtapaAtiva] = useState<EtapaCozinha>('novos');
  const [busca, setBusca] = useState('');
  const [pedidoParaCancelarId, setPedidoParaCancelarId] = useState<string | null>(null);

  const filtrados = useMemo(() => pedidos.filter((p) => pedidoCorrespondeBusca(p, busca)), [busca, pedidos]);

  const grupos = useMemo(
    () => ({
      pendentes: filtrados.filter((p) => p.status === 'PENDENTE'),
      novos: filtrados.filter((p) => p.status === 'PAGO'),
      preparo: filtrados.filter((p) => p.status === 'PREPARANDO'),
      prontos: filtrados.filter((p) => p.status === 'PRONTO'),
      caminho: filtrados.filter((p) => p.status === 'SAIU_PARA_ENTREGA'),
      finalizados: filtrados.filter((p) => p.status === 'ENTREGUE' || p.status === 'CANCELADO'),
    }),
    [filtrados]
  );

  const pedidoParaCancelar = pedidoParaCancelarId ? pedidos.find((p) => p.id === pedidoParaCancelarId) ?? null : null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F3F3]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E16349] border-t-transparent" />
      </div>
    );
  }

  const etapas: { id: EtapaCozinha; titulo: string; quantidade: number }[] = [
    { id: 'novos', titulo: 'Entrada / Pagos', quantidade: grupos.novos.length },
    { id: 'preparo', titulo: 'Em Preparo', quantidade: grupos.preparo.length },
    { id: 'prontos', titulo: 'Pronto para Envio', quantidade: grupos.prontos.length },
    { id: 'caminho', titulo: 'A Caminho', quantidade: grupos.caminho.length },
    { id: 'finalizados', titulo: 'Finalizados', quantidade: grupos.finalizados.length },
  ];

  const pedidosDaEtapa = etapaAtiva === 'finalizados' ? [] : grupos[etapaAtiva];
  const mostrarPendentes = etapaAtiva === 'novos' && grupos.pendentes.length > 0;
  const vazio = etapaAtiva === 'finalizados' ? grupos.finalizados.length === 0 : pedidosDaEtapa.length === 0 && !mostrarPendentes;
  const somPrecisaDeToque = somLigado && audioBloqueado;

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#F3F3F3] p-4 pb-24 font-sans text-[#1A1A1A] antialiased sm:p-8 sm:pb-24 md:py-12">
      <div className="w-full max-w-6xl space-y-6">
        <BarraNavegacaoCozinha />

        <header className="flex items-end justify-between gap-3 px-1 select-none">
          <div className="leading-tight">
            <h1 className="text-xl font-bold tracking-tight text-[#1A1A1A]">Monitor de produção</h1>
            <span className="mt-0.5 block text-[11px] font-semibold text-zinc-500">Fila de pedidos em tempo real</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void sincronizar()}
              disabled={sincronizando}
              title={conexao === 'online' ? 'Atualizar lista agora' : 'Tentar reconectar'}
              className={`flex h-9 items-center gap-2 rounded-xl border bg-white px-3 transition disabled:opacity-60 ${
                conexao === 'offline' ? 'border-red-200' : 'border-zinc-300 hover:border-zinc-400'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  conexao === 'online' ? 'animate-pulse bg-emerald-500' : conexao === 'offline' ? 'bg-red-500' : 'bg-amber-400'
                }`}
                aria-hidden="true"
              />
              <span className={`text-[9px] font-semibold uppercase tracking-widest ${conexao === 'offline' ? 'text-red-700' : 'text-zinc-500'}`}>
                {sincronizando ? 'Atualizando' : ROTULO_CONEXAO[conexao]}
              </span>
            </button>

            <button
              type="button"
              onClick={somPrecisaDeToque ? liberarSom : alternarSom}
              aria-pressed={somLigado}
              aria-label={somPrecisaDeToque ? 'Toque para liberar o som dos pedidos' : somLigado ? 'Desligar som de novos pedidos' : 'Ligar som de novos pedidos'}
              title={somPrecisaDeToque ? 'Toque para liberar o som' : somLigado ? 'Som ligado' : 'Som desligado'}
              className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border px-2.5 transition ${
                somPrecisaDeToque
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : somLigado
                    ? 'border-zinc-300 bg-white text-[#1A1A1A] hover:border-zinc-400'
                    : 'border-zinc-300 bg-white text-zinc-400 hover:border-zinc-400'
              }`}
            >
              {somLigado ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5 6 9H2v6h4l5 4V5z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M19 5a10 10 0 0 1 0 14" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5 6 9H2v6h4l5 4V5z" />
                  <path d="m22 9-6 6M16 9l6 6" />
                </svg>
              )}
              {somPrecisaDeToque && <span className="text-[10px] font-bold uppercase tracking-wider">Ativar som</span>}
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto rounded-2xl p-1" aria-label="Etapas dos pedidos">
            {etapas.map((etapa) => {
              const ativa = etapa.id === etapaAtiva;
              return (
                <button
                  key={etapa.id}
                  type="button"
                  onClick={() => setEtapaAtiva(etapa.id)}
                  aria-current={ativa ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-all ${
                    ativa ? 'bg-[#E16349] font-bold text-white shadow-sm' : 'font-medium text-zinc-600 hover:text-[#1A1A1A]'
                  }`}
                >
                  {etapa.titulo}
                  <span className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold ${ativa ? 'bg-white/20 text-white' : 'bg-white text-zinc-500'}`}>
                    {etapa.quantidade}
                  </span>
                </button>
              );
            })}
          </nav>

          <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 md:w-64">
            <svg className="h-3.5 w-3.5 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="sr-only">Buscar pedido</span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nº, nome ou telefone"
              className="min-w-0 flex-1 bg-transparent text-xs text-[#1A1A1A] placeholder:text-zinc-400 focus:outline-none"
            />
          </label>
        </div>

        <section className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
          {mostrarPendentes && (
            <FaixaPedidosPendentes
              pedidos={grupos.pendentes}
              agora={agora}
              cancelandoIds={cancelandoIds}
              onCancelar={(pedido) => setPedidoParaCancelarId(pedido.id)}
            />
          )}

          {vazio && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                {busca ? 'Nenhum pedido encontrado' : 'Esteira limpa'}
              </span>
            </div>
          )}

          {etapaAtiva === 'finalizados' ? (
            grupos.finalizados.length > 0 && <ListaPedidosFinalizados pedidos={grupos.finalizados} agora={agora} nomeLoja={nomeLoja} />
          ) : (
            <ColunaEsteiraCozinha
              pedidos={pedidosDaEtapa}
              agora={agora}
              nomeLoja={nomeLoja}
              entregadores={entregadores}
              cancelandoIds={cancelandoIds}
              onAvancar={avancarPedido}
              onCancelar={(pedido) => setPedidoParaCancelarId(pedido.id)}
              onAtribuirEntregador={atribuirEntregador}
            />
          )}
        </section>
      </div>

      <ModalCancelarPedido
        pedido={pedidoParaCancelar}
        cancelando={pedidoParaCancelar ? cancelandoIds.includes(pedidoParaCancelar.id) : false}
        onFechar={() => setPedidoParaCancelarId(null)}
        onConfirmar={cancelarPedido}
      />

      <AvisoCozinha aviso={aviso} onDesfazer={desfazer} onFechar={fecharAviso} />
    </div>
  );
}
