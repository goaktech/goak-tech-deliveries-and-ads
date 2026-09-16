'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface AdicionalItemPedidoCozinha {
  id: string;
  nome: string;
}

export interface ItemPedidoDetalhado {
  id: string;
  quantidade: number;
  item_cardapio: { nome: string };
  adicionais: AdicionalItemPedidoCozinha[];
}

export type StatusPedidoCozinha = 'PENDENTE' | 'PAGO' | 'PREPARANDO' | 'PRONTO' | 'SAIU_PARA_ENTREGA' | 'ENTREGUE';

export interface EntregadorCozinha {
  id: string;
  nome: string;
}

export interface PedidoCozinha {
  id: string;
  status: StatusPedidoCozinha;
  valor_total: number;
  forma_pagamento: string;
  dados_cliente: {
    nome: string;
    telefone: string;
    tipoEntrega?: 'ENTREGA' | 'RETIRADA';
    endereco?: { rua: string; numero: string; bairro: string; cidade?: string; cep?: string };
  };
  created_at: string;
  itens_pedido: ItemPedidoDetalhado[];
  entregador_id: string | null;
  entregador_nome: string | null;
}

interface ItemPedidoSelecionado {
  id: string;
  quantidade: number;
  itens_cardapio: {
    nome: string;
  } | null;
  itens_pedido_complementos: Array<{
    id: string;
    nome: string;
  }> | null;
}

interface PedidoSelecionado {
  id: string;
  status: PedidoCozinha['status'];
  valor_total: number;
  forma_pagamento: string;
  dados_cliente: PedidoCozinha['dados_cliente'];
  created_at: string;
  entregador_id: string | null;
  entregadores: { nome: string } | null;
  itens_pedido: ItemPedidoSelecionado[] | null;
}

interface PedidoRealtime {
  id: string;
  restaurante_id: string;
  status: PedidoCozinha['status'];
  valor_total: number;
  forma_pagamento: string;
  dados_cliente: PedidoCozinha['dados_cliente'];
  created_at: string;
  entregador_id?: string | null;
}

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export function useCozinha() {
  const supabase = useMemo(() => createClient(), []);
  
  const [pedidos, setPedidos] = useState<PedidoCozinha[]>([]);
  const [entregadores, setEntregadores] = useState<EntregadorCozinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [restauranteId, setRestauranteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dispararAlertaSonoro = useCallback(() => {
    try {
      const webkitWindow = window as WindowWithWebkitAudio;
      const AudioContextCtor = window.AudioContext || webkitWindow.webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }

      const audioCtx = new AudioContextCtor();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (err) {
      console.error('Falha ao emitir áudio nativo:', err);
    }
  }, []);

  const buscarItensDoPedido = useCallback(async (pedidoId: string): Promise<ItemPedidoDetalhado[]> => {
    const { data: itensBuscados } = await supabase
      .from('itens_pedido')
      .select('id, quantidade, itens_cardapio ( nome ), itens_pedido_complementos ( id, nome )')
      .eq('pedido_id', pedidoId);

    const itensFormatados = ((itensBuscados || []) as unknown as ItemPedidoSelecionado[]).map((i) => ({
      id: i.id,
      quantidade: i.quantidade,
      item_cardapio: { nome: i.itens_cardapio?.nome || 'Item Desconhecido' },
      adicionais: (i.itens_pedido_complementos || []).map((a) => ({ id: a.id, nome: a.nome }))
    }));

    return itensFormatados;
  }, [supabase]);

  const buscarPedidosAtivosDoBanco = useCallback(async (idDoRestaurante: string): Promise<PedidoCozinha[]> => {
    const { data: listaPedidos } = await supabase
      .from('pedidos')
      .select(`
        id, status, valor_total, forma_pagamento, dados_cliente, created_at, entregador_id, entregadores ( nome ),
        itens_pedido ( id, quantidade, itens_cardapio ( nome ), itens_pedido_complementos ( id, nome ) )
      `)
      .eq('restaurante_id', idDoRestaurante)
      .in('status', ['PENDENTE', 'PAGO', 'PREPARANDO', 'PRONTO', 'SAIU_PARA_ENTREGA'])
      .order('created_at', { ascending: true });

    return ((listaPedidos || []) as unknown as PedidoSelecionado[]).map((p) => ({
      id: p.id,
      status: p.status,
      valor_total: p.valor_total,
      forma_pagamento: p.forma_pagamento,
      dados_cliente: p.dados_cliente,
      created_at: p.created_at,
      entregador_id: p.entregador_id ?? null,
      entregador_nome: p.entregadores?.nome ?? null,
      itens_pedido: (p.itens_pedido || []).map((i) => ({
        id: i.id,
        quantidade: i.quantidade,
        item_cardapio: { nome: i.itens_cardapio?.nome || 'Item Desconhecido' },
        adicionais: (i.itens_pedido_complementos || []).map((a) => ({ id: a.id, nome: a.nome }))
      }))
    }));
  }, [supabase]);

  const buscarEntregadoresAtivos = useCallback(async (idDoRestaurante: string): Promise<EntregadorCozinha[]> => {
    const { data } = await supabase
      .from('entregadores')
      .select('id, nome')
      .eq('restaurante_id', idDoRestaurante)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    return (data || []) as EntregadorCozinha[];
  }, [supabase]);

  useEffect(() => {
    async function carregarDadosIniciais() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;

        const { data: perfil } = await supabase
          .from('perfis_admin')
          .select('restaurante_id')
          .eq('id', user.id)
          .single();

        if (perfil?.restaurante_id) {
          setRestauranteId(perfil.restaurante_id);
          const [pedidosIniciais, entregadoresAtivos] = await Promise.all([
            buscarPedidosAtivosDoBanco(perfil.restaurante_id),
            buscarEntregadoresAtivos(perfil.restaurante_id),
          ]);
          setPedidos(pedidosIniciais);
          setEntregadores(entregadoresAtivos);
        }
      } catch (err) {
        console.error('Erro ao inicializar fila de pedidos da cozinha:', err);
      } finally {
        setLoading(false);
      }
    }
    carregarDadosIniciais();
  }, [buscarPedidosAtivosDoBanco, buscarEntregadoresAtivos, supabase]);

  useEffect(() => {
    if (!restauranteId) return;

    const canalCozinha = supabase
      .channel(`cozinha_realtime_${restauranteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, async (payload) => {
        const { eventType, new: novoRegistroRaw } = payload;
        const novoRegistro = novoRegistroRaw as Partial<PedidoRealtime> | null;

        if (!novoRegistro?.id || !novoRegistro.restaurante_id || novoRegistro.restaurante_id !== restauranteId) return;
        if (!novoRegistro.status) return;
        const statusAtual = novoRegistro.status;

        const adicionarPedidoNaFila = async (registro: PedidoRealtime) => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const itensFormatados = await buscarItensDoPedido(registro.id);
          const pedidoCompleto: PedidoCozinha = {
            id: registro.id, status: registro.status, valor_total: registro.valor_total,
            forma_pagamento: registro.forma_pagamento, dados_cliente: registro.dados_cliente,
            created_at: registro.created_at, itens_pedido: itensFormatados,
            entregador_id: registro.entregador_id ?? null, entregador_nome: null
          };
          setPedidos((prev) => prev.some(p => p.id === pedidoCompleto.id) ? prev : [...prev, pedidoCompleto]);
          dispararAlertaSonoro();
        };

        if (eventType === 'INSERT' && ['PENDENTE', 'PAGO', 'PREPARANDO', 'PRONTO', 'SAIU_PARA_ENTREGA'].includes(statusAtual)) {
          await adicionarPedidoNaFila(novoRegistro as PedidoRealtime);
        }

        if (eventType === 'UPDATE') {
          if (statusAtual === 'ENTREGUE') {
            setPedidos((prev) => prev.filter((p) => p.id !== novoRegistro.id));
          } else {
            setPedidos((prev) => {
              const existe = prev.some((p) => p.id === novoRegistro.id);
              if (!existe && ['PENDENTE', 'PAGO', 'PREPARANDO', 'PRONTO', 'SAIU_PARA_ENTREGA'].includes(statusAtual)) {
                adicionarPedidoNaFila(novoRegistro as PedidoRealtime);
                return prev;
              }
              return prev.map((p) => (p.id === novoRegistro.id ? { ...p, status: statusAtual } : p));
            });
          }
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(canalCozinha); 
    };
  }, [buscarItensDoPedido, restauranteId, supabase, dispararAlertaSonoro]);

  const executarReconciliacaoPedidos = async () => {
    if (!restauranteId || sincronizando) return;
    setSincronizando(true);
    try {
      const pedidosBanco = await buscarPedidosAtivosDoBanco(restauranteId);
      const idsNaTela = pedidos.map(p => p.id);
      const pedidosRepresados = pedidosBanco.filter(p => !idsNaTela.includes(p.id));
      if (pedidosRepresados.length > 0) {
        setPedidos((prev) => [...prev, ...pedidosRepresados].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
        dispararAlertaSonoro();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSincronizando(false);
    }
  };

  const alterarStatusPedido = (pedidoId: string, novoStatus: PedidoCozinha['status']) => {
    startTransition(async () => {
      try {
        const resposta = await fetch(`/api/admin/pedidos/${pedidoId}/status`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: novoStatus }),
        });

        if (!resposta.ok) {
          const body = await resposta.json().catch(() => ({}));
          throw new Error(body?.error || 'Falha ao atualizar status do pedido.');
        }
      } catch (error) {
        console.error('Falha ao sincronizar status do pedido na cozinha:', error);
      }
    });
  };

  const atribuirEntregador = (pedidoId: string, entregadorId: string | null) => {
    const entregadorEscolhido = entregadorId ? entregadores.find((e) => e.id === entregadorId) ?? null : null;

    setPedidos((prev) =>
      prev.map((p) =>
        p.id === pedidoId
          ? { ...p, entregador_id: entregadorId, entregador_nome: entregadorEscolhido?.nome ?? null }
          : p
      )
    );

    startTransition(async () => {
      try {
        const resposta = await fetch(`/api/admin/pedidos/${pedidoId}/entregador`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ entregadorId }),
        });

        if (!resposta.ok) {
          const body = await resposta.json().catch(() => ({}));
          throw new Error(body?.error || 'Falha ao atribuir entregador.');
        }
      } catch (error) {
        console.error('Falha ao atribuir entregador ao pedido:', error);
      }
    });
  };

  return {
    pedidos,
    entregadores,
    loading,
    sincronizando,
    isPending,
    executarReconciliacaoPedidos,
    alterarStatusPedido,
    atribuirEntregador,
  };
}
