'use server';

import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { calcularIntervalo, type PeriodoMetricas } from '@/utils/periodo-metricas';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import {
  avaliarTokenMetaAds,
  buscarInsightsPeriodoMetaAds,
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
  data: string;
  impressoes: number;
  cliques: number;
  gasto: number | string;
  updated_at: string;
}

type BaseResumo = Pick<ResumoMetricasMetaAds, 'contaNome' | 'moeda' | 'diasParaExpirar'>;

/** Soma os dias e recalcula as taxas (CTR, CPC, CPM) sobre o total, não pela média das taxas. */
function resumoDasLinhas(
  linhas: Array<Pick<LinhaCacheMetaAds, 'impressoes' | 'cliques' | 'gasto'>>,
  base: BaseResumo,
  desatualizado: boolean
): ResumoMetricasMetaAds {
  const impressoes = linhas.reduce((acc, l) => acc + Number(l.impressoes), 0);
  const cliques = linhas.reduce((acc, l) => acc + Number(l.cliques), 0);
  const gasto = linhas.reduce((acc, l) => acc + Number(l.gasto), 0);

  return {
    ...RESUMO_BASE,
    ...base,
    conectado: true,
    estado: 'ok',
    desatualizado,
    impressoes,
    cliques,
    gasto: Math.round(gasto * 100) / 100,
    ctr: impressoes > 0 ? (cliques / impressoes) * 100 : 0,
    cpc: cliques > 0 ? gasto / cliques : 0,
    cpm: impressoes > 0 ? (gasto / impressoes) * 1000 : 0,
  };
}

export async function obterMetricasMetaAds(periodo: PeriodoMetricas = 'hoje'): Promise<ResumoMetricasMetaAds> {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    const integracao = await obterIntegracaoMetaAdsPorRestauranteId(restauranteId);
    const token = avaliarTokenMetaAds(integracao);

    if (!integracao || token.estado === 'ausente' || !integracao.access_token || !integracao.ad_account_id) {
      return RESUMO_BASE;
    }

    const base: BaseResumo = {
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
    const intervalo = calcularIntervalo(periodo, hoje);

    const { data: linhasCache } = await supabase
      .from('metricas_meta_ads_diarias')
      .select('data, impressoes, cliques, gasto, updated_at')
      .eq('restaurante_id', restauranteId)
      .gte('data', intervalo.desde)
      .lte('data', intervalo.ate);

    const cache = (linhasCache || []) as LinhaCacheMetaAds[];
    const porDia = new Map(cache.map((l) => [l.data, l]));
    const agora = Date.now();

    // Dia fechado (já gravado depois de terminar) não muda mais; hoje vale 30 min.
    const diaPrecisaBuscar = (dia: string) => {
      const linha = porDia.get(dia);
      if (!linha) return true;
      if (dia === hoje) return agora - new Date(linha.updated_at).getTime() >= CACHE_VALIDO_MS;
      // Dia passado gravado antes de terminar (ex.: ontem à tarde) ainda estava incompleto: refaz uma vez.
      const fimDoDia = new Date(`${dia}T00:00:00.000-03:00`).getTime() + 86_400_000;
      return new Date(linha.updated_at).getTime() < fimDoDia;
    };

    if (!intervalo.dias.some(diaPrecisaBuscar)) {
      return resumoDasLinhas(cache, base, false);
    }

    try {
      const insights = await buscarInsightsPeriodoMetaAds(
        integracao.access_token,
        integracao.ad_account_id,
        intervalo.desde,
        intervalo.ate
      );
      const insightsPorDia = new Map(insights.map((i) => [i.data, i]));
      const atualizadoEm = new Date().toISOString();

      // Grava todos os dias do intervalo (zerados quando não houve veiculação) para não refazer a consulta.
      const linhasParaGravar = intervalo.dias.map((dia) => {
        const i = insightsPorDia.get(dia);
        return {
          restaurante_id: restauranteId,
          data: dia,
          impressoes: i?.impressoes ?? 0,
          cliques: i?.cliques ?? 0,
          gasto: i?.gasto ?? 0,
          ctr: i?.ctr ?? 0,
          cpc: i?.cpc ?? 0,
          cpm: i?.cpm ?? 0,
          updated_at: atualizadoEm,
        };
      });

      const { error: erroUpsert } = await supabase
        .from('metricas_meta_ads_diarias')
        .upsert(linhasParaGravar, { onConflict: 'restaurante_id,data' });

      if (erroUpsert) {
        console.error('Falha ao cachear métricas de Meta Ads:', erroUpsert);
      }

      return resumoDasLinhas(linhasParaGravar, base, false);
    } catch (error) {
      if (ehErroTokenMetaAds(error)) {
        // A Meta recusou o token: marca como expirado e pede para o gestor reconectar.
        await marcarTokenMetaAdsInvalido(restauranteId);
        return { ...RESUMO_BASE, ...base, diasParaExpirar: null, estado: 'reconectar' };
      }

      console.error('Falha ao buscar métricas na Meta:', error);
      // Falha passageira (rede, limite de requisições): mostra o último dado em cache, se houver.
      if (cache.length > 0) {
        return resumoDasLinhas(cache, base, true);
      }
      return { ...RESUMO_BASE, ...base, estado: 'erro' };
    }
  } catch (error) {
    console.error('Erro na action obterMetricasMetaAds:', error);
    return { ...RESUMO_BASE, estado: 'erro' };
  }
}
