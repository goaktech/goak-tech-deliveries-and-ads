import React from 'react';
import { obterMetricasGrowth } from '@/actions/adminMetricas';
import { obterMetricasMetaAds } from '@/actions/adminMetricasMetaAds';
import { CardsPerformanceGrowth } from '@/components/metricas/CardsPerformanceGrowth';
import { GraficoFunilGrowth } from '@/components/metricas/GraficoFunilGrowth';
import { MetricasMetaAds } from '@/components/metricas/MetricasMetaAds';
import { RetornoSobreAnuncios } from '@/components/metricas/RetornoSobreAnuncios';
import { SeletorPeriodoMetricas } from '@/components/metricas/SeletorPeriodoMetricas';
import { AdminNavHeader } from '@/components/admin/AdminNavHeader';
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
    <div className="min-h-screen bg-[#F3F3F3] text-[#1A1A1A] font-sans antialiased flex items-start justify-center p-4 sm:p-8 md:py-12">
      <div className="w-full min-w-0 max-w-4xl space-y-6">

        <AdminNavHeader activeTab="metricas" />

        <SeletorPeriodoMetricas periodo={periodo} />

        <CardsPerformanceGrowth dados={dadosGrowth} textoPeriodo={textoPeriodo} />

        <GraficoFunilGrowth dados={dadosGrowth} />
        <MetricasMetaAds dados={dadosMetaAds} textoPeriodo={textoPeriodo} />
        <RetornoSobreAnuncios growth={dadosGrowth} metaAds={dadosMetaAds} textoPeriodo={textoPeriodo} />

      </div>
    </div>
  );
}
