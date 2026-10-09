'use client';

import Link from 'next/link';
import type { ResumoMetricasMetaAds } from '@/actions/adminMetricasMetaAds';

function formatarMoeda(valor: number, moeda = 'BRL') {
  try {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: moeda });
  } catch {
    return `${moeda} ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function formatarNumero(valor: number) {
  return valor.toLocaleString('pt-BR');
}

function formatarPercentual(valor: number) {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function MetricasMetaAds({ dados, textoPeriodo = 'de hoje' }: { dados: ResumoMetricasMetaAds; textoPeriodo?: string }) {
  if (dados.estado === 'reconectar') {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-6">
        <div className="mb-3">
          <h3 className="text-base font-bold uppercase tracking-wider text-[#1A1A1A]">Meta Ads</h3>
          <p className="mt-0.5 text-[11px] font-medium text-amber-800">
            A autorização com a Meta expirou ou foi revogada. Reconecte para voltar a ver as métricas
            {dados.contaNome ? ` da conta ${dados.contaNome}` : ''}.
          </p>
        </div>
        <Link
          href="/admin/integracoes"
          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white"
        >
          Reconectar Meta Ads
        </Link>
      </section>
    );
  }

  if (dados.estado === 'erro') {
    return (
      <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-1">
          <h3 className="text-base font-bold uppercase tracking-wider text-[#1A1A1A]">Meta Ads</h3>
          <p className="mt-0.5 text-[11px] font-medium text-zinc-500">
            Não foi possível buscar as métricas na Meta agora. Tente novamente em alguns minutos.
          </p>
        </div>
      </section>
    );
  }

  if (!dados.conectado) {
    return (
      <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-3">
          <h3 className="text-base font-bold uppercase tracking-wider text-[#1A1A1A]">Meta Ads</h3>
          <p className="mt-0.5 text-[11px] font-medium text-zinc-500">
            Conecte sua conta de anúncios para ver impressões, cliques e gasto real aqui.
          </p>
        </div>
        <Link
          href="/admin/integracoes"
          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white"
        >
          Conectar Meta Ads
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4">
        <h3 className="text-base font-bold uppercase tracking-wider text-[#1A1A1A]">Meta Ads</h3>
        <p className="mt-0.5 text-[11px] font-medium text-zinc-500">
          {dados.contaNome ? `Conta: ${dados.contaNome} — ` : ''}
          Indicadores de mídia paga {textoPeriodo}.
        </p>
        {dados.desatualizado ? (
          <p className="mt-1 text-[11px] font-medium text-amber-700">
            A Meta não respondeu agora; mostrando o último dado salvo.
          </p>
        ) : null}
        {dados.diasParaExpirar !== null ? (
          <p className="mt-1 text-[11px] font-medium text-amber-700">
            A autorização com a Meta expira em {dados.diasParaExpirar} {dados.diasParaExpirar === 1 ? 'dia' : 'dias'}.{' '}
            <Link href="/admin/integracoes" className="underline">
              Reconectar
            </Link>
          </p>
        ) : null}
        {dados.moeda !== 'BRL' ? (
          <p className="mt-1 text-[11px] font-medium text-zinc-500">
            Valores na moeda da conta de anúncios ({dados.moeda}), sem conversão para real.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Impressões</div>
          <div className="mt-1 text-lg font-bold text-zinc-900">{formatarNumero(dados.impressoes)}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Cliques</div>
          <div className="mt-1 text-lg font-bold text-zinc-900">{formatarNumero(dados.cliques)}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Gasto</div>
          <div className="mt-1 text-lg font-bold text-zinc-900">{formatarMoeda(dados.gasto, dados.moeda)}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">CTR</div>
          <div className="mt-1 text-lg font-bold text-zinc-900">{formatarPercentual(dados.ctr)}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">CPC médio</div>
          <div className="mt-1 text-lg font-bold text-zinc-900">{formatarMoeda(dados.cpc, dados.moeda)}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">CPM médio</div>
          <div className="mt-1 text-lg font-bold text-zinc-900">{formatarMoeda(dados.cpm, dados.moeda)}</div>
        </div>
      </div>
    </section>
  );
}
