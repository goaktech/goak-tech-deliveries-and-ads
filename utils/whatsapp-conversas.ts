// utils/whatsapp-conversas.ts
// WhatsApp, cenário 5: conversas no número do Appetitoso.
// - O webhook grava cada mensagem recebida (registrarMensagensRecebidas) e o status das respostas.
// - Cada conversa vai para a loja do último pedido do cliente (função SQL whatsapp_rotear_conversa);
//   sem pedido nos últimos 60 dias, fica só na caixa da equipe Appetitoso.
// - A resposta pelo painel é texto livre e só vale dentro da janela de 24 h da Meta.
// As tabelas só aceitam service_role: toda leitura filtra pelo escopo (loja do gestor ou plataforma).

import { createWebhookAdminClient } from '@/utils/supabase/webhook';

export const JANELA_RESPOSTA_MS = 24 * 60 * 60 * 1000;

export type EscopoConversas = { tipo: 'loja'; restauranteId: string } | { tipo: 'plataforma' };

/** DDD + 8 últimos dígitos: o mesmo cliente casa com ou sem o 9 e com ou sem o 55. */
export function chaveTelefone(telefone: string | null | undefined): string | null {
  let digitos = String(telefone ?? '').replace(/\D/g, '');
  if (digitos.length > 11 && digitos.startsWith('55')) digitos = digitos.slice(2);
  if (digitos.length < 10) return null;
  return digitos.slice(0, 2) + digitos.slice(-8);
}

// ---------------------------------------------------------------- webhook

interface MensagemMeta {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
  location?: { name?: string; address?: string };
  reaction?: { emoji?: string };
  referral?: { source_id?: string; source_type?: string; source_url?: string; headline?: string };
}

export interface ValorWebhookMensagens {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: MensagemMeta[];
}

const ROTULO_TIPO: Record<string, string> = {
  image: '[foto]',
  audio: '[áudio]',
  video: '[vídeo]',
  document: '[documento]',
  sticker: '[figurinha]',
  location: '[localização]',
  contacts: '[contato]',
  reaction: '[reação]',
  unsupported: '[mensagem não suportada]',
};

/** Texto legível de qualquer tipo de mensagem (mídia vira um rótulo, com a legenda quando houver). */
export function textoDaMensagem(m: MensagemMeta): string {
  switch (m.type) {
    case 'text':
      return m.text?.body ?? '';
    case 'button':
      return m.button?.text ?? '';
    case 'interactive':
      return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '[resposta]';
    case 'reaction':
      return m.reaction?.emoji ? `[reação ${m.reaction.emoji}]` : '[reação]';
    case 'location':
      return ['[localização]', m.location?.name, m.location?.address].filter(Boolean).join(' ');
    default: {
      const legenda = m.image?.caption ?? m.video?.caption ?? m.document?.caption ?? m.document?.filename;
      const rotulo = ROTULO_TIPO[m.type ?? ''] ?? `[${m.type ?? 'mensagem'}]`;
      return legenda ? `${rotulo} ${legenda}` : rotulo;
    }
  }
}

/** Grava as mensagens de clientes de um evento "messages" do webhook. Repetição (mesmo wamid) é ignorada. */
export async function registrarMensagensRecebidas(valor: ValorWebhookMensagens): Promise<number> {
  const mensagens = valor.messages ?? [];
  if (!mensagens.length) return 0;

  const supabase = createWebhookAdminClient();
  const nomes = new Map((valor.contacts ?? []).map((c) => [c.wa_id ?? '', c.profile?.name ?? null]));
  const rotas = new Map<string, { restaurante_id: string | null; pedido_id: string | null }>();
  let gravadas = 0;

  for (const m of mensagens) {
    const telefone = String(m.from ?? '').replace(/\D/g, '');
    const chave = chaveTelefone(telefone);
    if (!m.id || !telefone || !chave) continue;

    if (!rotas.has(chave)) {
      const { data } = await supabase.rpc('whatsapp_rotear_conversa', { p_chave: chave });
      const rota = Array.isArray(data) ? data[0] : null;
      rotas.set(chave, { restaurante_id: rota?.restaurante_id ?? null, pedido_id: rota?.pedido_id ?? null });
    }
    const rota = rotas.get(chave)!;

    const { error } = await supabase.from('whatsapp_mensagens').upsert(
      {
        wamid: m.id,
        direcao: 'entrada',
        phone_number_id: valor.metadata?.phone_number_id ?? null,
        telefone,
        chave_telefone: chave,
        nome_contato: nomes.get(m.from ?? '') ?? null,
        tipo: m.type ?? 'text',
        texto: textoDaMensagem(m).slice(0, 4000),
        restaurante_id: rota.restaurante_id,
        pedido_id: rota.pedido_id,
        anuncio_id: m.referral?.source_id ?? null,
        anuncio_json: m.referral ?? null,
        ocorrido_em: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString(),
      },
      { onConflict: 'wamid', ignoreDuplicates: true }
    );
    if (error) throw new Error(`whatsapp_mensagens: ${error.message}`);
    gravadas += 1;
  }

  return gravadas;
}

const ORDEM_STATUS: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

/** Status (sent/delivered/read/failed) de uma resposta enviada pelo painel. Nunca regride; falha sempre vale. */
export async function aplicarStatusResposta(status: { id?: string; status?: string; errors?: unknown }) {
  if (!status.id || !status.status) return;
  const supabase = createWebhookAdminClient();
  const { data: atual } = await supabase
    .from('whatsapp_mensagens')
    .select('id, status')
    .eq('wamid', status.id)
    .eq('direcao', 'saida')
    .maybeSingle();
  if (!atual) return;

  const novo = ORDEM_STATUS[status.status] ?? 0;
  const anterior = ORDEM_STATUS[atual.status ?? ''] ?? 0;
  if (status.status !== 'failed' && novo <= anterior) return;

  await supabase
    .from('whatsapp_mensagens')
    .update(status.status === 'failed' ? { status: 'failed', erro_json: { errors: status.errors ?? null } } : { status: status.status })
    .eq('id', atual.id);
}

// ---------------------------------------------------------------- painel

export interface ResumoConversa {
  chave: string;
  telefone: string;
  nome: string | null;
  ultimaMensagem: string;
  ultimaDirecao: 'entrada' | 'saida';
  ultimaEm: string;
  janelaAberta: boolean;
  restauranteId: string | null;
  restauranteNome: string | null;
  numeroPedido: number | null;
  veioDeAnuncio: boolean;
}

export interface MensagemConversa {
  id: string;
  direcao: 'entrada' | 'saida';
  texto: string;
  tipo: string;
  status: string | null;
  ocorridoEm: string;
}

interface LinhaMensagem {
  id: string;
  direcao: 'entrada' | 'saida';
  telefone: string;
  chave_telefone: string;
  nome_contato: string | null;
  tipo: string;
  texto: string | null;
  status: string | null;
  restaurante_id: string | null;
  pedido_id: string | null;
  anuncio_id: string | null;
  ocorrido_em: string;
}

const COLUNAS = 'id, direcao, telefone, chave_telefone, nome_contato, tipo, texto, status, restaurante_id, pedido_id, anuncio_id, ocorrido_em';

/** false quando a migração das conversas ainda não foi aplicada. */
export async function conversasDisponiveis(): Promise<boolean> {
  const { error } = await createWebhookAdminClient().from('whatsapp_mensagens').select('id', { head: true, count: 'exact' }).limit(1);
  return !error;
}

/** Conversas dos últimos 30 dias, a mais recente primeiro. */
export async function listarConversas(escopo: EscopoConversas): Promise<ResumoConversa[]> {
  const supabase = createWebhookAdminClient();
  let consulta = supabase
    .from('whatsapp_mensagens')
    .select(COLUNAS)
    .gte('ocorrido_em', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('ocorrido_em', { ascending: false })
    .limit(2000);
  if (escopo.tipo === 'loja') consulta = consulta.eq('restaurante_id', escopo.restauranteId);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  const linhas = (data ?? []) as LinhaMensagem[];

  const porChave = new Map<string, LinhaMensagem[]>();
  for (const l of linhas) {
    const lista = porChave.get(l.chave_telefone) ?? [];
    lista.push(l);
    porChave.set(l.chave_telefone, lista);
  }

  const restauranteIds = [...new Set(linhas.map((l) => l.restaurante_id).filter((id): id is string => Boolean(id)))];
  const pedidoIds = [...new Set(linhas.map((l) => l.pedido_id).filter((id): id is string => Boolean(id)))];
  const [{ data: lojas }, { data: pedidos }] = await Promise.all([
    restauranteIds.length
      ? supabase.from('restaurantes').select('id, nome').in('id', restauranteIds)
      : Promise.resolve({ data: [] as { id: string; nome: string | null }[] }),
    pedidoIds.length
      ? supabase.from('pedidos').select('id, numero_pedido').in('id', pedidoIds)
      : Promise.resolve({ data: [] as { id: string; numero_pedido: number | null }[] }),
  ]);
  const nomeLoja = new Map((lojas ?? []).map((l) => [l.id as string, (l.nome as string | null) ?? null]));
  const numeroPedido = new Map((pedidos ?? []).map((p) => [p.id as string, (p.numero_pedido as number | null) ?? null]));

  return [...porChave.entries()].map(([chave, mensagens]) => {
    const ultima = mensagens[0];
    const ultimaEntrada = mensagens.find((m) => m.direcao === 'entrada');
    const comRota = mensagens.find((m) => m.restaurante_id) ?? ultima;
    const comPedido = mensagens.find((m) => m.pedido_id);
    return {
      chave,
      telefone: (ultimaEntrada ?? ultima).telefone,
      nome: mensagens.find((m) => m.nome_contato)?.nome_contato ?? null,
      ultimaMensagem: ultima.texto ?? '',
      ultimaDirecao: ultima.direcao,
      ultimaEm: ultima.ocorrido_em,
      janelaAberta: Boolean(ultimaEntrada && Date.now() - new Date(ultimaEntrada.ocorrido_em).getTime() < JANELA_RESPOSTA_MS),
      restauranteId: comRota.restaurante_id,
      restauranteNome: comRota.restaurante_id ? nomeLoja.get(comRota.restaurante_id) ?? null : null,
      numeroPedido: comPedido?.pedido_id ? numeroPedido.get(comPedido.pedido_id) ?? null : null,
      veioDeAnuncio: mensagens.some((m) => m.anuncio_id),
    };
  });
}

/** Histórico de uma conversa (até 200 mensagens), da mais antiga para a mais nova. */
export async function obterMensagensDaConversa(escopo: EscopoConversas, chave: string): Promise<MensagemConversa[]> {
  let consulta = createWebhookAdminClient()
    .from('whatsapp_mensagens')
    .select(COLUNAS)
    .eq('chave_telefone', chave)
    .order('ocorrido_em', { ascending: false })
    .limit(200);
  if (escopo.tipo === 'loja') consulta = consulta.eq('restaurante_id', escopo.restauranteId);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return ((data ?? []) as LinhaMensagem[]).reverse().map((m) => ({
    id: m.id,
    direcao: m.direcao,
    texto: m.texto ?? '',
    tipo: m.tipo,
    status: m.status,
    ocorridoEm: m.ocorrido_em,
  }));
}

/**
 * Para responder: a última mensagem do cliente visível neste escopo. A janela de 24 h é do número
 * do Appetitoso com aquele cliente; a loja só responde conversas que foram roteadas para ela.
 */
export async function obterUltimaEntrada(escopo: EscopoConversas, chave: string) {
  let consulta = createWebhookAdminClient()
    .from('whatsapp_mensagens')
    .select('telefone, phone_number_id, restaurante_id, pedido_id, ocorrido_em')
    .eq('chave_telefone', chave)
    .eq('direcao', 'entrada')
    .order('ocorrido_em', { ascending: false })
    .limit(1);
  if (escopo.tipo === 'loja') consulta = consulta.eq('restaurante_id', escopo.restauranteId);

  const { data } = await consulta.maybeSingle();
  return data as { telefone: string; phone_number_id: string | null; restaurante_id: string | null; pedido_id: string | null; ocorrido_em: string } | null;
}

/** Grava a resposta enviada pelo painel (o status chega depois pelo webhook). */
export async function registrarResposta(params: {
  wamid: string;
  telefone: string;
  phoneNumberId: string;
  texto: string;
  restauranteId: string | null;
  pedidoId: string | null;
  enviadoPor: string | null;
}) {
  const { error } = await createWebhookAdminClient().from('whatsapp_mensagens').insert({
    wamid: params.wamid,
    direcao: 'saida',
    phone_number_id: params.phoneNumberId,
    telefone: params.telefone,
    chave_telefone: chaveTelefone(params.telefone) ?? params.telefone,
    tipo: 'text',
    texto: params.texto,
    restaurante_id: params.restauranteId,
    pedido_id: params.pedidoId,
    status: 'sent',
    enviado_por: params.enviadoPor,
  });
  if (error) throw new Error(error.message);
}

/** Últimos eventos do webhook que deram erro (painel da plataforma). */
export async function listarEventosComErro(limite = 10) {
  const { data } = await createWebhookAdminClient()
    .from('whatsapp_eventos')
    .select('id, campo, erro, criado_em')
    .not('erro', 'is', null)
    .order('criado_em', { ascending: false })
    .limit(limite);
  return (data ?? []) as { id: string; campo: string | null; erro: string; criado_em: string }[];
}
