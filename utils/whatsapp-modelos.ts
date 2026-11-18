// utils/whatsapp-modelos.ts
// Número e modelos (templates) do WhatsApp do Appetitoso, para o painel da equipe da plataforma.
// Usa a credencial do servidor (obterCredencialPlataforma); os modelos ficam na WABA do número.

import { obterCredencialPlataforma } from '@/utils/whatsapp-envio';

export interface NumeroWhatsappPlataforma {
  telefone: string | null;
  nomeVerificado: string | null;
  qualidade: string | null;
  statusNome: string | null;
  verificacao: string | null;
  plataforma: string | null;
}

export interface ModeloWhatsapp {
  id: string;
  nome: string;
  status: string;
  categoria: string;
  idioma: string;
  corpo: string;
  motivo: string | null;
}

async function graph<T>(caminho: string, init?: RequestInit): Promise<T> {
  const cred = obterCredencialPlataforma();
  if (!cred) throw new Error('Número do Appetitoso não configurado no servidor.');
  const resposta = await fetch(`https://graph.facebook.com/${cred.apiVersion}/${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${cred.accessToken}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(corpo?.error?.error_user_msg || corpo?.error?.message || `HTTP ${resposta.status}`);
  return corpo as T;
}

export async function obterNumeroPlataforma(): Promise<NumeroWhatsappPlataforma> {
  const cred = obterCredencialPlataforma();
  if (!cred) throw new Error('Número do Appetitoso não configurado no servidor.');
  const d = await graph<Record<string, string | undefined>>(
    `${cred.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,name_status,code_verification_status,platform_type`
  );
  return {
    telefone: d.display_phone_number ?? null,
    nomeVerificado: d.verified_name ?? null,
    qualidade: d.quality_rating ?? null,
    statusNome: d.name_status ?? null,
    verificacao: d.code_verification_status ?? null,
    plataforma: d.platform_type ?? null,
  };
}

export async function listarModelos(): Promise<ModeloWhatsapp[]> {
  const cred = obterCredencialPlataforma();
  if (!cred?.wabaId) throw new Error('Falta WHATSAPP_BUSINESS_WABA_ID no servidor.');
  const d = await graph<{ data?: { id: string; name: string; status: string; category: string; language: string; rejected_reason?: string; components?: { type: string; text?: string }[] }[] }>(
    `${cred.wabaId}/message_templates?fields=id,name,status,category,language,rejected_reason,components&limit=100`
  );
  return (d.data ?? []).map((t) => ({
    id: t.id,
    nome: t.name,
    status: t.status,
    categoria: t.category,
    idioma: t.language,
    corpo: t.components?.find((c) => c.type === 'BODY')?.text ?? '',
    motivo: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null,
  }));
}

/** Cria um modelo só com corpo de texto. Cada {{n}} precisa de um exemplo, na ordem. */
export async function criarModelo(params: { nome: string; categoria: 'UTILITY' | 'MARKETING'; idioma: string; corpo: string; exemplos: string[] }) {
  const cred = obterCredencialPlataforma();
  if (!cred?.wabaId) throw new Error('Falta WHATSAPP_BUSINESS_WABA_ID no servidor.');
  const componente: Record<string, unknown> = { type: 'BODY', text: params.corpo };
  if (params.exemplos.length) componente.example = { body_text: [params.exemplos] };
  return graph<{ id: string; status: string }>(`${cred.wabaId}/message_templates`, {
    method: 'POST',
    body: JSON.stringify({ name: params.nome, category: params.categoria, language: params.idioma, components: [componente] }),
  });
}
