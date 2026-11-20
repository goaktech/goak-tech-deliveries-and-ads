'use server';

// WhatsApp, cenário 2: quem da LOJA recebe o aviso interno de venda (pedido pago).
// As tabelas só aceitam o service_role (RLS sem políticas), então toda ação confere a loja do gestor logado
// e filtra por restaurante_id. Destinatários da equipe Appetitoso (restaurante_id NULL) não passam por aqui:
// são cadastrados direto no banco (ver docs/whatsapp-cenarios.md).

import { revalidatePath } from 'next/cache';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { normalizarTelefoneWhatsapp } from '@/utils/whatsapp-envio';

const LIMITE_DESTINATARIOS = 10;

export async function adicionarDestinatarioAvisoVenda(dados: { nome: string; telefone: string; consentimento: boolean }) {
  const nome = String(dados.nome ?? '').trim();
  const telefone = normalizarTelefoneWhatsapp(dados.telefone);
  if (!nome) return { success: false, error: 'Informe o nome de quem vai receber.' };
  if (!telefone) return { success: false, error: 'Informe o WhatsApp com DDD, por exemplo (61) 99999-9999.' };
  if (dados.consentimento !== true) {
    return { success: false, error: 'Confirme que a pessoa concordou em receber os avisos no WhatsApp.' };
  }

  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = createWebhookAdminClient();

  const { count } = await supabase
    .from('whatsapp_destinatarios_aviso')
    .select('id', { count: 'exact', head: true })
    .eq('restaurante_id', restauranteId);
  if ((count ?? 0) >= LIMITE_DESTINATARIOS) {
    return { success: false, error: `Limite de ${LIMITE_DESTINATARIOS} números por loja.` };
  }

  const { error } = await supabase.from('whatsapp_destinatarios_aviso').insert({
    restaurante_id: restauranteId,
    nome: nome.slice(0, 80),
    telefone,
    papel: 'loja',
    ativo: true,
    consentimento_em: new Date().toISOString(),
  });

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Esse número já está na lista.' };
    return { success: false, error: `Erro ao salvar: ${error.message}` };
  }

  revalidatePath('/admin/integracoes');
  return { success: true };
}

export async function alternarDestinatarioAvisoVenda(id: string, ativo: boolean) {
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = createWebhookAdminClient();
  const { error } = await supabase
    .from('whatsapp_destinatarios_aviso')
    .update({ ativo })
    .eq('id', id)
    .eq('restaurante_id', restauranteId);

  if (error) return { success: false, error: `Erro ao atualizar: ${error.message}` };
  revalidatePath('/admin/integracoes');
  return { success: true };
}

export async function removerDestinatarioAvisoVenda(id: string) {
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = createWebhookAdminClient();
  const { error } = await supabase
    .from('whatsapp_destinatarios_aviso')
    .delete()
    .eq('id', id)
    .eq('restaurante_id', restauranteId);

  if (error) return { success: false, error: `Erro ao remover: ${error.message}` };
  revalidatePath('/admin/integracoes');
  return { success: true };
}
