import React from 'react';
import { obterMetricasGrowth } from '@/actions/adminMetricas';
import { obterMetricasMetaAds } from '@/actions/adminMetricasMetaAds';
import { CardsPerformanceGrowth } from '@/components/metricas/CardsPerformanceGrowth';
import { GraficoFunilGrowth } from '@/components/metricas/GraficoFunilGrowth';
import { MetricasMetaAds } from '@/components/metricas/MetricasMetaAds';
import { RetornoSobreAnuncios } from '@/components/metricas/RetornoSobreAnuncios';
import { SeletorPeriodoMetricas } from '@/components/metricas/SeletorPeriodoMetricas';
import { descricaoPeriodo, lerPeriodoMetricas } from '@/utils/periodo-metricas';

export const revalidate = 0;

export default async function PainelMetricasAdmin({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string | string[] }>;
}) {
  const periodo = lerPeriodoMetricas((await searchParams).periodo);
  const textoPeriodo = descricaoPeriodo(periodo);

  const [dadosGrowth, dadosMetaAds] = await Promise.all([
    obterMetricasGrowth(periodo),
    obterMetricasMetaAds(periodo),
  ]);

  return (
    <>

        <SeletorPeriodoMetricas periodo={periodo} />

        <CardsPerformanceGrowth dados={dadosGrowth} textoPeriodo={textoPeriodo} />

        <GraficoFunilGrowth dados={dadosGrowth} />
        <MetricasMetaAds dados={dadosMetaAds} textoPeriodo={textoPeriodo} />
        <RetornoSobreAnuncios growth={dadosGrowth} metaAds={dadosMetaAds} textoPeriodo={textoPeriodo} />

    </>
  );
}
