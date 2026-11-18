'use server';

// WhatsApp, cenário 5: responder conversas pelo número do Appetitoso e criar modelos.
// - A loja só responde conversas roteadas para ela (último pedido do cliente).
// - A equipe Appetitoso (PLATAFORMA_ADMIN_EMAILS) responde qualquer conversa e cuida dos modelos.
// - Texto livre só dentro da janela de 24 h desde a última mensagem do cliente (regra da Meta).

import { revalidatePath } from 'next/cache';
import { obterRestauranteIdDoGestorLogado } from '@/utils/admin-auth';
import { ehAdminPlataforma } from '@/utils/plataforma-admin';
import { createClient } from '@/utils/supabase/server';
import {
  JANELA_RESPOSTA_MS,
  obterUltimaEntrada,
  registrarResposta,
  type EscopoConversas,
} from '@/utils/whatsapp-conversas';
import { enviarTextoWhatsapp, obterCredencialPlataforma } from '@/utils/whatsapp-envio';
import { criarModelo } from '@/utils/whatsapp-modelos';

type Resultado = { success: true } | { success: false; error: string };

async function escopoDoUsuario(comoPlataforma: boolean): Promise<EscopoConversas> {
  if (comoPlataforma) {
    if (!(await ehAdminPlataforma())) throw new Error('Acesso restrito à equipe Appetitoso.');
    return { tipo: 'plataforma' };
  }
  return { tipo: 'loja', restauranteId: await obterRestauranteIdDoGestorLogado() };
}

export async function responderConversaWhatsapp(dados: { chave: string; texto: string; comoPlataforma?: boolean }): Promise<Resultado> {
  const texto = String(dados.texto ?? '').trim();
  if (!texto) return { success: false, error: 'Escreva a resposta.' };
  if (texto.length > 4096) return { success: false, error: 'A resposta pode ter até 4.096 caracteres.' };

  let escopo: EscopoConversas;
  try {
    escopo = await escopoDoUsuario(dados.comoPlataforma === true);
  } catch (erro) {
    return { success: false, error: erro instanceof Error ? erro.message : 'Acesso negado.' };
  }

  const ultima = await obterUltimaEntrada(escopo, String(dados.chave ?? ''));
  if (!ultima) return { success: false, error: 'Conversa não encontrada.' };
  if (Date.now() - new Date(ultima.ocorrido_em).getTime() >= JANELA_RESPOSTA_MS) {
    return {
      success: false,
      error: 'Passaram 24 h desde a última mensagem do cliente. Pela regra do WhatsApp, agora só dá para mandar um modelo aprovado.',
    };
  }

  const cred = obterCredencialPlataforma();
  if (!cred) return { success: false, error: 'O número do Appetitoso ainda não está configurado no servidor.' };
  // Responde pelo mesmo número em que a mensagem chegou.
  const remetente = { ...cred, phoneNumberId: ultima.phone_number_id ?? cred.phoneNumberId };

  try {
    const { messageId } = await enviarTextoWhatsapp({ remetente, para: ultima.telefone, texto });
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await registrarResposta({
      wamid: messageId ?? `local-${Date.now()}`,
      telefone: ultima.telefone,
      phoneNumberId: remetente.phoneNumberId,
      texto,
      restauranteId: ultima.restaurante_id,
      pedidoId: ultima.pedido_id,
      enviadoPor: user?.id ?? null,
    });
  } catch (erro) {
    return { success: false, error: `O WhatsApp recusou o envio: ${erro instanceof Error ? erro.message : 'erro desconhecido'}` };
  }

  revalidatePath('/admin/conversas');
  revalidatePath('/admin/whatsapp');
  return { success: true };
}

const NOME_MODELO = /^[a-z0-9_]{1,512}$/;

export async function criarModeloWhatsapp(dados: {
  nome: string;
  categoria: string;
  corpo: string;
  exemplos: string[];
}): Promise<Resultado> {
  if (!(await ehAdminPlataforma())) return { success: false, error: 'Acesso restrito à equipe Appetitoso.' };

  const nome = String(dados.nome ?? '').trim().toLowerCase();
  const corpo = String(dados.corpo ?? '').trim();
  const categoria = dados.categoria === 'MARKETING' ? 'MARKETING' : 'UTILITY';
  if (!NOME_MODELO.test(nome)) return { success: false, error: 'Nome só com letras minúsculas, números e _ (ex.: aviso_venda_loja).' };
  if (!corpo) return { success: false, error: 'Escreva o texto do modelo.' };
  if (corpo.length > 1024) return { success: false, error: 'O texto pode ter até 1.024 caracteres.' };

  const variaveis = [...new Set([...corpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  if (variaveis.some((n, i) => n !== i + 1)) {
    return { success: false, error: 'Numere as variáveis em ordem, a partir de {{1}}.' };
  }
  const exemplos = (dados.exemplos ?? []).map((e) => String(e ?? '').trim());
  if (exemplos.length < variaveis.length || exemplos.slice(0, variaveis.length).some((e) => !e)) {
    return { success: false, error: 'Dê um exemplo para cada variável ({{1}}, {{2}}...). A Meta exige.' };
  }

  try {
    await criarModelo({
      nome,
      categoria,
      idioma: process.env.WHATSAPP_TEMPLATE_LANGUAGE_CODE ?? 'pt_BR',
      corpo,
      exemplos: exemplos.slice(0, variaveis.length),
    });
  } catch (erro) {
    return { success: false, error: `A Meta recusou o modelo: ${erro instanceof Error ? erro.message : 'erro desconhecido'}` };
  }

  revalidatePath('/admin/whatsapp');
  return { success: true };
}
