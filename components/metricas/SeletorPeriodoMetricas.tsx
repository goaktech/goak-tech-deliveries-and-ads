import Link from 'next/link';
import { PERIODOS_METRICAS, type PeriodoMetricas } from '@/utils/periodo-metricas';

export function SeletorPeriodoMetricas({ periodo }: { periodo: PeriodoMetricas }) {
  return (
    <nav aria-label="Período das métricas" className="grid grid-cols-3 gap-1 rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm">
      {PERIODOS_METRICAS.map((p) => {
        const ativo = p.valor === periodo;
        return (
          <Link
            key={p.valor}
            href={p.valor === 'hoje' ? '/admin/metricas' : `/admin/metricas?periodo=${p.valor}`}
            aria-current={ativo ? 'page' : undefined}
            className={`flex min-h-11 items-center justify-center rounded-xl px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
              ativo ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {p.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
