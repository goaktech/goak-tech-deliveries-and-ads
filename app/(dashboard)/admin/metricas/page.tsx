import React from 'react';
import { obterMetricasGrowthDoDia } from '@/actions/adminMetricas';
import { obterMetricasMetaAdsDoDia } from '@/actions/adminMetricasMetaAds';
import { CardsPerformanceGrowth } from '@/components/metricas/CardsPerformanceGrowth';
import { GraficoFunilGrowth } from '@/components/metricas/GraficoFunilGrowth';
import { MetricasMetaAds } from '@/components/metricas/MetricasMetaAds';
import { AdminNavHeader } from '@/components/admin/AdminNavHeader';

export const revalidate = 0;

export default async function PainelMetricasAdmin() {
  const [dadosGrowth, dadosMetaAds] = await Promise.all([
    obterMetricasGrowthDoDia(),
    obterMetricasMetaAdsDoDia(),
  ]);

  return (
    <div className="min-h-screen bg-[#F3F3F3] text-[#1A1A1A] font-sans antialiased flex items-start justify-center p-4 sm:p-8 md:py-12">
      <div className="w-full max-w-4xl space-y-6">
        
        <AdminNavHeader activeTab="metricas" />

        <CardsPerformanceGrowth dados={dadosGrowth} />

        <GraficoFunilGrowth dados={dadosGrowth} />
        <MetricasMetaAds dados={dadosMetaAds} />

      </div>
    </div>
  );
}
