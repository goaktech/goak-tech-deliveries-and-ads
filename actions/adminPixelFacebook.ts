'use server';

import { createClient } from '@/utils/supabase/server';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { revalidatePath } from 'next/cache';

const PIXEL_ID_REGEX = /^\d+$/;

export async function atualizarMetaPixelId(pixelId: string | null) {
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = await createClient();

  const valorNormalizado = pixelId?.trim() || null;
  if (valorNormalizado && !PIXEL_ID_REGEX.test(valorNormalizado)) {
    return { success: false, error: 'ID do Pixel inválido. Deve conter apenas números.' };
  }

  const { data: restaurante, error: errRestaurante } = await supabase
    .from('restaurantes')
    .select('slug')
    .eq('id', restauranteId)
    .single();

  if (errRestaurante || !restaurante) {
    return { success: false, error: 'Restaurante não encontrado.' };
  }

  const { error } = await supabase
    .from('restaurantes')
    .update({ meta_pixel_id: valorNormalizado })
    .eq('id', restauranteId);

  if (error) {
    return { success: false, error: `Erro ao salvar Pixel: ${error.message}` };
  }

  revalidatePath('/admin/integracoes');
  revalidatePath(`/${restaurante.slug}`);

  return { success: true };
}
