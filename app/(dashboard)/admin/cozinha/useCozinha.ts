'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  type DadosClientePedido,
  type StatusPedido,
  obterProximoStatusPedido,
  obterTipoEntregaPedido,
} from '@/utils/pedido-status';
import { rotuloNumeroPedido } from '@/utils/cozinha';

export type StatusPedidoCozinha = StatusPedido;
export type EstadoConexaoCozinha = 'conectando' | 'online' | 'offline';

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

export interface EntregadorCozinha {
  id: string;
  nome: string;
}

export interface PedidoCozinha {
  id: string;
  numero_pedido: number | null;
  status: StatusPedidoCozinha;
  valor_total: number;
  forma_pagamento: string;
  dados_cliente: DadosClientePedido;
  cliente_latitude: number | null;
  cliente_longitude: number | null;
  created_at: string;
  updated_at: string;
  tempo_preparo_estimado_min: number | null;
  tempo_deslocamento_min: number | null;
  motivo_cancelamento: string | null;
  itens_pedido: ItemPedidoDetalhado[];
  entregador_id: string | null;
  entregador_nome: string | null;
}

export interface AvisoCozinha {
  chave: number;
  texto: string;
  tipo: 'info' | 'sucesso' | 'erro';
  pedidoIdDesfazer: string | null;
}

interface ItemPedidoSelecionado {
  id: string;
  quantidade: number;
  itens_cardapio: { nome: string } | null;
  itens_pedido_complementos: Array<{ id: string; nome: string }> | null;
}

interface PedidoSelecionado {
  id: string;
  numero_pedido: number | null;
  status: StatusPedidoCozinha;
  valor_total: number | string;
  forma_pagamento: string;
  dados_cliente: DadosClientePedido | null;
  cliente_latitude: number | null;
  cliente_longitude: number | null;
  created_at: string;
  updated_at: string | null;
  tempo_preparo_estimado_min: number | null;
  tempo_deslocamento_min: number | null;
  motivo_cancelamento: string | null;
  entregador_id: string | null;
  entregadores: { nome: string } | Array<{ nome: string }> | null;
  itens_pedido: ItemPedidoSelecionado[] | null;
}

type PedidoRealtime = Partial<Omit<PedidoSelecionado, 'entregadores' | 'itens_pedido'>> & {
  id?: string;
  restaurante_id?: string;
};

interface AcaoAgendada {
  timeout: ReturnType<typeof setTimeout>;
  statusDestino: StatusPedidoCozinha;
}

type WindowComAudioLegado = Window & { webkitAudioContext?: typeof AudioContext };

const COLUNAS_PEDIDO = `
  id, numero_pedido, status, valor_total, forma_pagamento, dados_cliente, cliente_latitude, cliente_longitude,
  created_at, updated_at, tempo_preparo_estimado_min, tempo_deslocamento_min, motivo_cancelamento,
  entregador_id, entregadores ( nome ),
  itens_pedido ( id, quantidade, itens_cardapio ( nome ), itens_pedido_complementos ( id, nome ) )
`;

const STATUS_EM_ANDAMENTO: StatusPedidoCozinha[] = ['PAGO', 'PREPARANDO', 'PRONTO', 'SAIU_PARA_ENTREGA'];
const STATUS_FINALIZADOS: StatusPedidoCozinha[] = ['ENTREGUE', 'CANCELADO'];
const JANELA_PENDENTES_MS = 12 * 60 * 60 * 1000;
const ATRASO_CONFIRMACAO_MS = 5000;
const INTERVALO_ALARME_MS = 30000;
const CHAVE_PREFERENCIA_SOM = 'goak:cozinha:som';

function inicioDoDiaIso() {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  return data.toISOString();
}

function mapearItens(itens: ItemPedidoSelecionado[] | null | undefined): ItemPedidoDetalhado[] {
  return (itens || []).map((item) => ({
    id: item.id,
    quantidade: Number(item.quantidade),
    item_cardapio: { nome: item.itens_cardapio?.nome || 'Item desconhecido' },
    adicionais: (item.itens_pedido_complementos || []).map((adicional) => ({ id: adicional.id, nome: adicional.nome })),
  }));
}

function mapearPedido(bruto: PedidoSelecionado): PedidoCozinha {
  const entregador = Array.isArray(bruto.entregadores) ? bruto.entregadores[0] : bruto.entregadores;
  return {
    id: bruto.id,
    numero_pedido: bruto.numero_pedido ?? null,
    status: bruto.status,
    valor_total: Number(bruto.valor_total),
    forma_pagamento: bruto.forma_pagamento,
    dados_cliente: bruto.dados_cliente ?? { nome: '', telefone: '' },
    cliente_latitude: bruto.cliente_latitude ?? null,
    cliente_longitude: bruto.cliente_longitude ?? null,
    created_at: bruto.created_at,
    updated_at: bruto.updated_at ?? bruto.created_at,
    tempo_preparo_estimado_min: bruto.tempo_preparo_estimado_min ?? null,
    tempo_deslocamento_min: bruto.tempo_deslocamento_min ?? null,
    motivo_cancelamento: bruto.motivo_cancelamento ?? null,
    itens_pedido: mapearItens(bruto.itens_pedido),
    entregador_id: bruto.entregador_id ?? null,
    entregador_nome: entregador?.nome ?? null,
  };
}

function statusRelevante(pedido: Pick<PedidoCozinha, 'status' | 'created_at' | 'updated_at'>) {
  if (STATUS_EM_ANDAMENTO.includes(pedido.status)) return true;
  if (pedido.status === 'PENDENTE') {
    return Date.now() - new Date(pedido.created_at).getTime() <= JANELA_PENDENTES_MS;
  }
  return new Date(pedido.updated_at).getTime() >= new Date(inicioDoDiaIso()).getTime();
}

function ordenarPorChegada(lista: PedidoCozinha[]) {
  return [...lista].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function lerPreferenciaSom() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(CHAVE_PREFERENCIA_SOM) !== 'desligado';
  } catch {
    return true;
  }
}

function salvarPreferenciaSom(ligado: boolean) {
  try {
    window.localStorage.setItem(CHAVE_PREFERENCIA_SOM, ligado ? 'ligado' : 'desligado');
  } catch {}
}

export function useCozinha() {
  const supabase = useMemo(() => createClient(), []);

  const [pedidosBase, setPedidosBase] = useState<PedidoCozinha[]>([]);
  const [statusAgendados, setStatusAgendados] = useState<Record<string, StatusPedidoCozinha>>({});
  const [entregadores, setEntregadores] = useState<EntregadorCozinha[]>([]);
  const [nomeLoja, setNomeLoja] = useState('');
  const [restauranteId, setRestauranteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [conexao, setConexao] = useState<EstadoConexaoCozinha>('conectando');
  const [aviso, setAviso] = useState<AvisoCozinha | null>(null);
  const [cancelandoIds, setCancelandoIds] = useState<string[]>([]);
  const [somLigado, setSomLigado] = useState(lerPreferenciaSom);
  const [audioBloqueado, setAudioBloqueado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  const pedidosRef = useRef<PedidoCozinha[]>([]);
  const entregadoresRef = useRef<EntregadorCozinha[]>([]);
  const acoesRef = useRef<Map<string, AcaoAgendada>>(new Map());
  const audioRef = useRef<AudioContext | null>(null);
  const somRef = useRef(somLigado);
  const jaConectouRef = useRef(false);
  const sincronizandoRef = useRef(false);
  const avisoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chaveAvisoRef = useRef(0);

  useEffect(() => {
    pedidosRef.current = pedidosBase;
  }, [pedidosBase]);

  useEffect(() => {
    entregadoresRef.current = entregadores;
  }, [entregadores]);

  const obterAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const janela = window as WindowComAudioLegado;
    const Construtor = window.AudioContext || janela.webkitAudioContext;
    if (!Construtor) return null;
    audioRef.current = new Construtor();
    return audioRef.current;
  }, []);

  const tocarAlerta = useCallback(() => {
    if (!somRef.current) return;
    const contexto = obterAudio();
    if (!contexto) return;
    if (contexto.state !== 'running') {
      setAudioBloqueado(true);
      void contexto.resume().catch(() => {});
      return;
    }
    try {
      const inicio = contexto.currentTime;
      [880, 660, 880].forEach((frequencia, indice) => {
        const oscilador = contexto.createOscillator();
        const ganho = contexto.createGain();
        const t0 = inicio + indice * 0.2;
        oscilador.type = 'sine';
        oscilador.frequency.setValueAtTime(frequencia, t0);
        ganho.gain.setValueAtTime(0.0001, t0);
        ganho.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
        ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        oscilador.connect(ganho);
        ganho.connect(contexto.destination);
        oscilador.start(t0);
        oscilador.stop(t0 + 0.2);
      });
    } catch (erro) {
      console.error('Falha ao tocar alerta sonoro da cozinha:', erro);
    }
  }, [obterAudio]);

  useEffect(() => {
    const destravarAudio = () => {
      const contexto = obterAudio();
      if (!contexto) return;
      void contexto
        .resume()
        .then(() => setAudioBloqueado(contexto.state !== 'running'))
        .catch(() => setAudioBloqueado(true));
    };
    const quadro = requestAnimationFrame(() => {
      const contexto = obterAudio();
      setAudioBloqueado(Boolean(contexto && contexto.state !== 'running'));
    });
    window.addEventListener('pointerdown', destravarAudio);
    window.addEventListener('keydown', destravarAudio);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('pointerdown', destravarAudio);
      window.removeEventListener('keydown', destravarAudio);
    };
  }, [obterAudio]);

  const alternarSom = useCallback(() => {
    const proximo = !somRef.current;
    somRef.current = proximo;
    setSomLigado(proximo);
    salvarPreferenciaSom(proximo);
    if (proximo) {
      const contexto = obterAudio();
      void contexto?.resume().then(() => {
        setAudioBloqueado(contexto.state !== 'running');
        tocarAlerta();
      });
    }
  }, [obterAudio, tocarAlerta]);

  const liberarSom = useCallback(() => {
    const contexto = obterAudio();
    if (!contexto) return;
    void contexto
      .resume()
      .then(() => {
        setAudioBloqueado(contexto.state !== 'running');
        tocarAlerta();
      })
      .catch(() => setAudioBloqueado(true));
  }, [obterAudio, tocarAlerta]);

  const mostrarAviso = useCallback((texto: string, tipo: AvisoCozinha['tipo'], pedidoIdDesfazer: string | null = null) => {
    chaveAvisoRef.current += 1;
    const chave = chaveAvisoRef.current;
    setAviso({ chave, texto, tipo, pedidoIdDesfazer });
    if (avisoTimeoutRef.current) clearTimeout(avisoTimeoutRef.current);
    avisoTimeoutRef.current = setTimeout(
      () => setAviso((atual) => (atual?.chave === chave ? null : atual)),
      pedidoIdDesfazer ? ATRASO_CONFIRMACAO_MS : tipo === 'erro' ? 9000 : 5000
    );
  }, []);

  const fecharAviso = useCallback(() => {
    if (avisoTimeoutRef.current) clearTimeout(avisoTimeoutRef.current);
    setAviso(null);
  }, []);

  const buscarPedidoPorId = useCallback(
    async (pedidoId: string): Promise<PedidoCozinha | null> => {
      const { data, error } = await supabase.from('pedidos').select(COLUNAS_PEDIDO).eq('id', pedidoId).maybeSingle();
      if (error || !data) return null;
      return mapearPedido(data as unknown as PedidoSelecionado);
    },
    [supabase]
  );

  const buscarPedidosDoBanco = useCallback(
    async (idRestaurante: string): Promise<PedidoCozinha[]> => {
      const limitePendentes = new Date(Date.now() - JANELA_PENDENTES_MS).toISOString();
      const filtro = [
        `status.in.(${STATUS_EM_ANDAMENTO.join(',')})`,
        `and(status.eq.PENDENTE,created_at.gte.${limitePendentes})`,
        `and(status.in.(${STATUS_FINALIZADOS.join(',')}),updated_at.gte.${inicioDoDiaIso()})`,
      ].join(',');

      const { data, error } = await supabase
        .from('pedidos')
        .select(COLUNAS_PEDIDO)
        .eq('restaurante_id', idRestaurante)
        .or(filtro)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return ((data || []) as unknown as PedidoSelecionado[]).map(mapearPedido);
    },
    [supabase]
  );

  const aplicarListaDoBanco = useCallback(
    (lista: PedidoCozinha[]) => {
      const anteriores = new Map(pedidosRef.current.map((p) => [p.id, p.status]));
      const chegouPedidoPago = lista.some((p) => p.status === 'PAGO' && anteriores.get(p.id) !== 'PAGO');
      pedidosRef.current = lista;
      setPedidosBase(lista);
      return chegouPedidoPago;
    },
    []
  );

  const sincronizar = useCallback(async () => {
    if (!restauranteId || sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    setSincronizando(true);
    try {
      const lista = await buscarPedidosDoBanco(restauranteId);
      if (aplicarListaDoBanco(lista)) tocarAlerta();
    } catch (erro) {
      console.error('Falha ao sincronizar pedidos da cozinha:', erro);
      mostrarAviso('Não foi possível atualizar a lista de pedidos.', 'erro');
    } finally {
      sincronizandoRef.current = false;
      setSincronizando(false);
    }
  }, [aplicarListaDoBanco, buscarPedidosDoBanco, mostrarAviso, restauranteId, tocarAlerta]);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: perfil } = await supabase
          .from('perfis_admin')
          .select('restaurante_id')
          .eq('id', user.id)
          .single();

        const idRestaurante = perfil?.restaurante_id as string | undefined;
        if (!idRestaurante || !ativo) return;

        const [lista, respostaEntregadores, respostaLoja] = await Promise.all([
          buscarPedidosDoBanco(idRestaurante),
          supabase
            .from('entregadores')
            .select('id, nome')
            .eq('restaurante_id', idRestaurante)
            .eq('ativo', true)
            .order('nome', { ascending: true }),
          fetch('/api/admin/restaurante', { cache: 'no-store' })
            .then((resposta) => (resposta.ok ? (resposta.json() as Promise<{ nome?: string }>) : null))
            .catch(() => null),
        ]);

        if (!ativo) return;
        setRestauranteId(idRestaurante);
        aplicarListaDoBanco(lista);
        setEntregadores((respostaEntregadores.data || []) as EntregadorCozinha[]);
        setNomeLoja(typeof respostaLoja?.nome === 'string' ? respostaLoja.nome : '');
      } catch (erro) {
        console.error('Erro ao carregar a fila de pedidos da cozinha:', erro);
        if (ativo) mostrarAviso('Não foi possível carregar os pedidos. Toque em Sincronizar.', 'erro');
      } finally {
        if (ativo) setLoading(false);
      }
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, [aplicarListaDoBanco, buscarPedidosDoBanco, mostrarAviso, supabase]);

  useEffect(() => {
    if (!restauranteId) return;

    const processarMudanca = async (eventType: string, registro: PedidoRealtime) => {
      if (!registro?.id || registro.restaurante_id !== restauranteId || !registro.status) return;
      const pedidoId = registro.id;
      const existente = pedidosRef.current.find((p) => p.id === pedidoId);

      if (!existente) {
        if (eventType === 'INSERT') {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
        const completo = await buscarPedidoPorId(pedidoId);
        if (!completo || !statusRelevante(completo)) return;
        setPedidosBase((atual) => (atual.some((p) => p.id === completo.id) ? atual : ordenarPorChegada([...atual, completo])));
        if (completo.status === 'PAGO') tocarAlerta();
        return;
      }

      const precisaRecarregarItens = existente.itens_pedido.length === 0;
      const entregadorId = registro.entregador_id === undefined ? existente.entregador_id : registro.entregador_id ?? null;
      const entregadorNome =
        entregadorId === existente.entregador_id
          ? existente.entregador_nome
          : entregadoresRef.current.find((e) => e.id === entregadorId)?.nome ?? null;

      const atualizado: PedidoCozinha = {
        ...existente,
        status: registro.status,
        numero_pedido: registro.numero_pedido ?? existente.numero_pedido,
        valor_total: registro.valor_total != null ? Number(registro.valor_total) : existente.valor_total,
        dados_cliente: registro.dados_cliente ?? existente.dados_cliente,
        updated_at: registro.updated_at ?? existente.updated_at,
        tempo_preparo_estimado_min: registro.tempo_preparo_estimado_min ?? existente.tempo_preparo_estimado_min,
        tempo_deslocamento_min: registro.tempo_deslocamento_min ?? existente.tempo_deslocamento_min,
        motivo_cancelamento:
          registro.motivo_cancelamento === undefined ? existente.motivo_cancelamento : registro.motivo_cancelamento,
        entregador_id: entregadorId,
        entregador_nome: entregadorNome,
      };

      setPedidosBase((atual) => {
        const lista = atual.map((p) => (p.id === pedidoId ? atualizado : p));
        return lista.filter((p) => p.id !== pedidoId || statusRelevante(p));
      });

      if (existente.status !== 'PAGO' && atualizado.status === 'PAGO') tocarAlerta();

      if (precisaRecarregarItens) {
        const completo = await buscarPedidoPorId(pedidoId);
        if (completo) {
          setPedidosBase((atual) =>
            atual.map((p) => (p.id === pedidoId ? { ...p, itens_pedido: completo.itens_pedido, dados_cliente: completo.dados_cliente } : p))
          );
        }
      }
    };

    const canal = supabase
      .channel(`cozinha_realtime_${restauranteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `restaurante_id=eq.${restauranteId}` },
        (payload) => {
          void processarMudanca(payload.eventType, payload.new as PedidoRealtime);
        }
      )
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED') {
          setConexao('online');
          if (jaConectouRef.current) void sincronizar();
          jaConectouRef.current = true;
          return;
        }
        if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT' || estado === 'CLOSED') {
          setConexao('offline');
        }
      });

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [buscarPedidoPorId, restauranteId, sincronizar, supabase, tocarAlerta]);

  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void sincronizar();
    };
    const aoFicarOnline = () => void sincronizar();
    const aoFicarOffline = () => setConexao('offline');
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', aoFicarOnline);
    window.addEventListener('offline', aoFicarOffline);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', aoFicarOnline);
      window.removeEventListener('offline', aoFicarOffline);
    };
  }, [sincronizar]);

  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(intervalo);
  }, []);

  const pedidos = useMemo(
    () =>
      pedidosBase.map((pedido) => {
        const agendado = statusAgendados[pedido.id];
        if (!agendado) return pedido;
        return { ...pedido, status: agendado, updated_at: STATUS_FINALIZADOS.includes(agendado) ? new Date(agora).toISOString() : pedido.updated_at };
      }),
    [agora, pedidosBase, statusAgendados]
  );

  const quantidadeNovos = useMemo(() => pedidos.filter((p) => p.status === 'PAGO').length, [pedidos]);

  useEffect(() => {
    if (quantidadeNovos === 0) return;
    const intervalo = setInterval(() => tocarAlerta(), INTERVALO_ALARME_MS);
    return () => clearInterval(intervalo);
  }, [quantidadeNovos, tocarAlerta]);

  useEffect(() => {
    const tituloOriginal = document.title;
    return () => {
      document.title = tituloOriginal;
    };
  }, []);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s[^·]*·\s/, '');
    document.title = quantidadeNovos > 0 ? `(${quantidadeNovos}) Novos pedidos · ${base}` : base;
  }, [quantidadeNovos]);

  useEffect(() => {
    type NavegadorComWakeLock = Navigator & { wakeLock?: { request: (tipo: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const navegador = navigator as NavegadorComWakeLock;
    if (!navegador.wakeLock) return;
    let trava: { release: () => Promise<void> } | null = null;
    let ativo = true;

    const pedirTrava = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const novaTrava = await navegador.wakeLock!.request('screen');
        if (!ativo) {
          void novaTrava.release().catch(() => {});
          return;
        }
        trava = novaTrava;
      } catch {}
    };

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'visible') void pedirTrava();
    };

    void pedirTrava();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      ativo = false;
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      void trava?.release().catch(() => {});
    };
  }, []);

  const removerAgendamento = useCallback((pedidoId: string) => {
    setStatusAgendados((atual) => {
      if (!(pedidoId in atual)) return atual;
      const proximo = { ...atual };
      delete proximo[pedidoId];
      return proximo;
    });
  }, []);

  const confirmarNoServidor = useCallback(
    async (pedidoId: string, statusDestino: StatusPedidoCozinha) => {
      acoesRef.current.delete(pedidoId);
      try {
        const resposta = await fetch(`/api/admin/pedidos/${pedidoId}/status`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: statusDestino }),
        });
        const corpo = (await resposta.json().catch(() => ({}))) as { error?: string; statusAtual?: StatusPedidoCozinha };

        if (!resposta.ok) {
          const acaoSeguinte = acoesRef.current.get(pedidoId);
          if (acaoSeguinte) {
            clearTimeout(acaoSeguinte.timeout);
            acoesRef.current.delete(pedidoId);
          }
          removerAgendamento(pedidoId);
          if (corpo.statusAtual) {
            setPedidosBase((atual) => atual.map((p) => (p.id === pedidoId ? { ...p, status: corpo.statusAtual! } : p)));
          }
          mostrarAviso(corpo.error || 'Não foi possível atualizar o pedido.', 'erro');
          return;
        }

        const agoraIso = new Date().toISOString();
        setPedidosBase((atual) => atual.map((p) => (p.id === pedidoId ? { ...p, status: statusDestino, updated_at: agoraIso } : p)));
        if (!acoesRef.current.has(pedidoId)) removerAgendamento(pedidoId);
      } catch (erro) {
        console.error('Falha ao enviar mudança de status do pedido:', erro);
        removerAgendamento(pedidoId);
        mostrarAviso('Sem conexão. A mudança do pedido não foi salva.', 'erro');
      }
    },
    [mostrarAviso, removerAgendamento]
  );

  const avancarPedido = useCallback(
    (pedido: PedidoCozinha) => {
      const statusDestino = obterProximoStatusPedido(pedido.status, obterTipoEntregaPedido(pedido.dados_cliente));
      if (!statusDestino) return;

      const anterior = acoesRef.current.get(pedido.id);
      if (anterior) {
        clearTimeout(anterior.timeout);
        void confirmarNoServidor(pedido.id, anterior.statusDestino);
      }

      const timeout = setTimeout(() => {
        void confirmarNoServidor(pedido.id, statusDestino);
      }, ATRASO_CONFIRMACAO_MS);
      acoesRef.current.set(pedido.id, { timeout, statusDestino });
      setStatusAgendados((atual) => ({ ...atual, [pedido.id]: statusDestino }));

      const destinoTexto: Record<string, string> = {
        PREPARANDO: 'foi para Em Preparo',
        PRONTO: 'está pronto',
        SAIU_PARA_ENTREGA: 'saiu para entrega',
        ENTREGUE: obterTipoEntregaPedido(pedido.dados_cliente) === 'RETIRADA' ? 'foi retirado' : 'foi entregue',
      };
      mostrarAviso(`Pedido ${rotuloNumeroPedido(pedido)} ${destinoTexto[statusDestino] ?? 'foi atualizado'}`, 'info', pedido.id);
    },
    [confirmarNoServidor, mostrarAviso]
  );

  const desfazer = useCallback(
    (pedidoId: string) => {
      const acao = acoesRef.current.get(pedidoId);
      if (acao) {
        clearTimeout(acao.timeout);
        acoesRef.current.delete(pedidoId);
      }
      removerAgendamento(pedidoId);
      fecharAviso();
    },
    [fecharAviso, removerAgendamento]
  );

  useEffect(() => {
    const acoes = acoesRef.current;
    const enviarPendentes = () => {
      acoes.forEach((acao, pedidoId) => {
        clearTimeout(acao.timeout);
        void fetch(`/api/admin/pedidos/${pedidoId}/status`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: acao.statusDestino }),
          keepalive: true,
        }).catch(() => {});
      });
      acoes.clear();
    };
    window.addEventListener('pagehide', enviarPendentes);
    return () => {
      window.removeEventListener('pagehide', enviarPendentes);
      enviarPendentes();
    };
  }, []);

  const cancelarPedido = useCallback(
    async (pedido: PedidoCozinha, motivo: string): Promise<boolean> => {
      const acao = acoesRef.current.get(pedido.id);
      if (acao) {
        clearTimeout(acao.timeout);
        acoesRef.current.delete(pedido.id);
      }
      removerAgendamento(pedido.id);
      setCancelandoIds((atual) => [...atual, pedido.id]);
      try {
        const resposta = await fetch(`/api/admin/pedidos/${pedido.id}/cancelar`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ motivo }),
        });
        const corpo = (await resposta.json().catch(() => ({}))) as { error?: string; foiPago?: boolean };

        if (!resposta.ok) {
          mostrarAviso(corpo.error || 'Não foi possível concluir a ação.', 'erro');
          return false;
        }

        const agoraIso = new Date().toISOString();
        setPedidosBase((atual) =>
          atual.map((p) => (p.id === pedido.id ? { ...p, status: 'CANCELADO', motivo_cancelamento: motivo, updated_at: agoraIso } : p))
        );

        const verbo = pedido.status === 'PAGO' || pedido.status === 'PENDENTE' ? 'recusado' : 'cancelado';
        mostrarAviso(
          corpo.foiPago
            ? `Pedido ${rotuloNumeroPedido(pedido)} ${verbo}. Faça a devolução do valor pelo Mercado Pago.`
            : `Pedido ${rotuloNumeroPedido(pedido)} ${verbo}.`,
          'sucesso'
        );
        return true;
      } catch (erro) {
        console.error('Falha ao cancelar pedido:', erro);
        mostrarAviso('Sem conexão. O pedido não foi alterado.', 'erro');
        return false;
      } finally {
        setCancelandoIds((atual) => atual.filter((id) => id !== pedido.id));
      }
    },
    [mostrarAviso, removerAgendamento]
  );

  const atribuirEntregador = useCallback(
    async (pedidoId: string, entregadorId: string | null) => {
      const anterior = pedidosRef.current.find((p) => p.id === pedidoId);
      const escolhido = entregadorId ? entregadoresRef.current.find((e) => e.id === entregadorId) ?? null : null;

      setPedidosBase((atual) =>
        atual.map((p) => (p.id === pedidoId ? { ...p, entregador_id: entregadorId, entregador_nome: escolhido?.nome ?? null } : p))
      );

      try {
        const resposta = await fetch(`/api/admin/pedidos/${pedidoId}/entregador`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ entregadorId }),
        });
        if (!resposta.ok) {
          const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };
          throw new Error(corpo.error || 'Falha ao atribuir entregador.');
        }
      } catch (erro) {
        if (anterior) {
          setPedidosBase((atual) =>
            atual.map((p) =>
              p.id === pedidoId ? { ...p, entregador_id: anterior.entregador_id, entregador_nome: anterior.entregador_nome } : p
            )
          );
        }
        mostrarAviso(erro instanceof Error ? erro.message : 'Falha ao atribuir entregador.', 'erro');
      }
    },
    [mostrarAviso]
  );

  return {
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
  };
}
