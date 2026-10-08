'use server';

import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import {
  avaliarTokenMetaAds,
  buscarInsightsDiariosMetaAds,
  dataDeHojeNoFuso,
  ehErroTokenMetaAds,
  marcarTokenMetaAdsInvalido,
  obterIntegracaoMetaAdsPorRestauranteId,
} from '@/utils/meta-ads';

const CACHE_VALIDO_MS = 30 * 60 * 1000;

export type EstadoMetricasMetaAds = 'nao_conectado' | 'reconectar' | 'erro' | 'ok';

export interface ResumoMetricasMetaAds {
  /** true só quando há dados (atuais ou o último cache) para mostrar. */
  conectado: boolean;
  estado: EstadoMetricasMetaAds;
  contaNome: string | null;
  /** Moeda da conta de anúncios (o gasto vem nela, sem conversão). */
  moeda: string;
  /** Dias até o token expirar, quando faltam poucos (aviso para reconectar). */
  diasParaExpirar: number | null;
  /** Dados do cache porque a Meta não respondeu agora. */
  desatualizado: boolean;
  impressoes: number;
  cliques: number;
  gasto: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

const RESUMO_BASE: ResumoMetricasMetaAds = {
  conectado: false,
  estado: 'nao_conectado',
  contaNome: null,
  moeda: 'BRL',
  diasParaExpirar: null,
  desatualizado: false,
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

function resumoDoCache(
  cache: LinhaCacheMetaAds,
  base: Pick<ResumoMetricasMetaAds, 'contaNome' | 'moeda' | 'diasParaExpirar'>,
  desatualizado: boolean
): ResumoMetricasMetaAds {
  return {
    ...RESUMO_BASE,
    ...base,
    conectado: true,
    estado: 'ok',
    desatualizado,
    impressoes: Number(cache.impressoes),
    cliques: Number(cache.cliques),
    gasto: Number(cache.gasto),
    ctr: Number(cache.ctr),
    cpc: Number(cache.cpc),
    cpm: Number(cache.cpm),
  };
}

export async function obterMetricasMetaAdsDoDia(): Promise<ResumoMetricasMetaAds> {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    const integracao = await obterIntegracaoMetaAdsPorRestauranteId(restauranteId);
    const token = avaliarTokenMetaAds(integracao);

    if (!integracao || token.estado === 'ausente' || !integracao.access_token || !integracao.ad_account_id) {
      return RESUMO_BASE;
    }

    const base = {
      contaNome: integracao.ad_account_name,
      moeda: integracao.ad_account_currency || 'BRL',
      diasParaExpirar: token.estado === 'expirando' ? token.diasRestantes : null,
    };

    if (token.estado === 'expirado') {
      return { ...RESUMO_BASE, ...base, estado: 'reconectar' };
    }

    const supabase = createWebhookAdminClient();
    // "Hoje" no fuso da conta de anúncios (e não em UTC), que é o dia que a Meta usa nos relatórios.
    const hoje = dataDeHojeNoFuso(integracao.ad_account_timezone);

    const { data: linhaCache } = await supabase
      .from('metricas_meta_ads_diarias')
      .select('impressoes, cliques, gasto, ctr, cpc, cpm, updated_at')
      .eq('restaurante_id', restauranteId)
      .eq('data', hoje)
      .maybeSingle();

    const cache = linhaCache as LinhaCacheMetaAds | null;
    const cacheValido = cache && Date.now() - new Date(cache.updated_at).getTime() < CACHE_VALIDO_MS;

    if (cache && cacheValido) {
      return resumoDoCache(cache, base, false);
    }

    try {
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

      return { ...RESUMO_BASE, ...base, conectado: true, estado: 'ok', ...insights };
    } catch (error) {
      if (ehErroTokenMetaAds(error)) {
        // A Meta recusou o token: marca como expirado e pede para o gestor reconectar.
        await marcarTokenMetaAdsInvalido(restauranteId);
        return { ...RESUMO_BASE, ...base, diasParaExpirar: null, estado: 'reconectar' };
      }

      console.error('Falha ao buscar métricas na Meta:', error);
      // Falha passageira (rede, limite de requisições): mostra o último dado em cache, se houver.
      if (cache) {
        return resumoDoCache(cache, base, true);
      }
      return { ...RESUMO_BASE, ...base, estado: 'erro' };
    }
  } catch (error) {
    console.error('Erro na action obterMetricasMetaAdsDoDia:', error);
    return { ...RESUMO_BASE, estado: 'erro' };
  }
}
