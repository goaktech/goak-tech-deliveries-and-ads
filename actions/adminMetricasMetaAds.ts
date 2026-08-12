'use server';

import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { buscarInsightsDiariosMetaAds, obterIntegracaoMetaAdsPorRestauranteId } from '@/utils/meta-ads';

const CACHE_VALIDO_MS = 30 * 60 * 1000;

export interface ResumoMetricasMetaAds {
  conectado: boolean;
  contaNome: string | null;
  impressoes: number;
  cliques: number;
  gasto: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

const RESUMO_VAZIO: ResumoMetricasMetaAds = {
  conectado: false,
  contaNome: null,
  impressoes: 0,
  cliques: 0,
  gasto: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
};

interface LinhaCacheMetaAds {
  impressoes: number;
  cliques: number;
  gasto: number | string;
  ctr: number | string;
  cpc: number | string;
  cpm: number | string;
  updated_at: string;
}

export async function obterMetricasMetaAdsDoDia(): Promise<ResumoMetricasMetaAds> {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    const integracao = await obterIntegracaoMetaAdsPorRestauranteId(restauranteId);

    if (!integracao || integracao.connection_status !== 'conectado' || !integracao.access_token || !integracao.ad_account_id) {
      return RESUMO_VAZIO;
    }

    const supabase = createWebhookAdminClient();
    const hoje = new Date().toISOString().split('T')[0];

    const { data: linhaCache } = await supabase
      .from('metricas_meta_ads_diarias')
      .select('impressoes, cliques, gasto, ctr, cpc, cpm, updated_at')
      .eq('restaurante_id', restauranteId)
      .eq('data', hoje)
      .maybeSingle();

    const cache = linhaCache as LinhaCacheMetaAds | null;
    const cacheValido = cache && Date.now() - new Date(cache.updated_at).getTime() < CACHE_VALIDO_MS;

    if (cacheValido) {
      return {
        conectado: true,
        contaNome: integracao.ad_account_name,
        impressoes: Number(cache.impressoes),
        cliques: Number(cache.cliques),
        gasto: Number(cache.gasto),
        ctr: Number(cache.ctr),
        cpc: Number(cache.cpc),
        cpm: Number(cache.cpm),
      };
    }

    const insights = await buscarInsightsDiariosMetaAds(integracao.access_token, integracao.ad_account_id, hoje);

    const { error: erroUpsert } = await supabase.from('metricas_meta_ads_diarias').upsert(
      {
        restaurante_id: restauranteId,
        data: hoje,
        impressoes: insights.impressoes,
        cliques: insights.cliques,
        gasto: insights.gasto,
        ctr: insights.ctr,
        cpc: insights.cpc,
        cpm: insights.cpm,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'restaurante_id,data' }
    );

    if (erroUpsert) {
      console.error('Falha ao cachear métricas de Meta Ads:', erroUpsert);
    }

    return {
      conectado: true,
      contaNome: integracao.ad_account_name,
      ...insights,
    };
  } catch (error) {
    console.error('Erro na action obterMetricasMetaAdsDoDia:', error);
    return RESUMO_VAZIO;
  }
}
