'use server';

import { revalidatePath } from 'next/cache';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

const VERSAO_PADRAO = 'v25.0';

interface ResultadoAcaoCapi {
  success: boolean;
  error?: string;
}

// Confere na Meta se o token enxerga o Pixel da loja antes de salvar.
async function validarTokenNoPixel(pixelId: string, token: string): Promise<string | null> {
  const versao = process.env.META_ADS_API_VERSION?.trim() || VERSAO_PADRAO;
  try {
    const resposta = await fetch(
      `https://graph.facebook.com/${versao}/${encodeURIComponent(pixelId)}?fields=id,name&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(8000), cache: 'no-store' }
    );
    if (resposta.ok) return null;
    const corpo = (await resposta.json().catch(() => ({}))) as { error?: { code?: number; message?: string } };
    if (corpo.error?.code === 190) return 'Token inválido ou expirado. Gere um novo no Gerenciador de Eventos.';
    return 'Esse token não tem acesso ao Pixel da loja. Gere o token no mesmo Pixel que está salvo acima.';
  } catch {
    return 'Não foi possível validar o token na Meta agora. Tente novamente em instantes.';
  }
}

export async function salvarMetaCapi(params: { token: string; codigoTeste?: string | null }): Promise<ResultadoAcaoCapi> {
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = createWebhookAdminClient();

  const token = params.token.trim();
  const codigoTeste = params.codigoTeste?.trim() || null;
  if (token.length < 20 || /\s/.test(token)) {
    return { success: false, error: 'Token inválido. Copie o token completo gerado no Gerenciador de Eventos.' };
  }
  if (codigoTeste && !/^[A-Za-z0-9_-]{1,64}$/.test(codigoTeste)) {
    return { success: false, error: 'Código de teste inválido.' };
  }

  const { data: restaurante } = await supabase
    .from('restaurantes')
    .select('meta_pixel_id')
    .eq('id', restauranteId)
    .maybeSingle();
  const pixelId = restaurante?.meta_pixel_id?.trim();
  if (!pixelId) {
    return { success: false, error: 'Salve primeiro o ID do Pixel; o token pertence a um Pixel.' };
  }

  const erroValidacao = await validarTokenNoPixel(pixelId, token);
  if (erroValidacao) return { success: false, error: erroValidacao };

  const { error } = await supabase.from('restaurante_integracoes_meta_capi').upsert(
    {
      restaurante_id: restauranteId,
      access_token: token,
      test_event_code: codigoTeste,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'restaurante_id' }
  );
  if (error) {
    console.error('Falha ao salvar token da API de Conversões:', error.message);
    return { success: false, error: 'Não foi possível salvar o token agora.' };
  }

  revalidatePath('/admin/integracoes');
  return { success: true };
}

export async function removerMetaCapi(): Promise<ResultadoAcaoCapi> {
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = createWebhookAdminClient();

  const { error } = await supabase.from('restaurante_integracoes_meta_capi').delete().eq('restaurante_id', restauranteId);
  if (error) {
    console.error('Falha ao remover token da API de Conversões:', error.message);
    return { success: false, error: 'Não foi possível remover o token agora.' };
  }

  revalidatePath('/admin/integracoes');
  return { success: true };
}
