import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

export const obterRestauranteIdDoGestorLogado = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Usuário não autenticado.');
  }

  const { data: perfil, error: perfilError } = await supabase
    .from('perfis_admin')
    .select('restaurante_id')
    .eq('id', user.id)
    .single();

  if (perfilError || !perfil?.restaurante_id) {
    throw new Error('Perfil administrativo sem restaurante vinculado.');
  }

  return perfil.restaurante_id as string;
});

export interface RestauranteCabecalhoAdmin {
  nome: string | null;
  slug: string | null;
  logoUrl: string | null;
}

export const obterRestauranteCabecalhoAdmin = cache(async (): Promise<RestauranteCabecalhoAdmin | null> => {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    const { data } = await createWebhookAdminClient()
      .from('restaurantes')
      .select('nome, slug, logo_url')
      .eq('id', restauranteId)
      .maybeSingle();

    if (!data) return null;

    return {
      nome: typeof data.nome === 'string' && data.nome.trim() ? data.nome.trim() : null,
      slug: typeof data.slug === 'string' ? data.slug : null,
      logoUrl: typeof data.logo_url === 'string' ? data.logo_url : null,
    };
  } catch (error) {
    console.error('Falha ao carregar o restaurante do cabeçalho:', error);
    return null;
  }
});
