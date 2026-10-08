import type { ResumoMetricasFunil } from '@/actions/adminMetricas';
import type { ResumoMetricasMetaAds } from '@/actions/adminMetricasMetaAds';

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Props {
  growth: ResumoMetricasFunil;
  metaAds: ResumoMetricasMetaAds;
  textoPeriodo: string;
}

/** Cruza o faturamento do Appetitoso com o gasto real na Meta. Só aparece com a conta em reais e gasto > 0. */
export function RetornoSobreAnuncios({ growth, metaAds, textoPeriodo }: Props) {
  if (!metaAds.conectado || metaAds.moeda !== 'BRL' || metaAds.gasto <= 0) return null;

  const roas = growth.faturamentoTotal / metaAds.gasto;
  const cpa = growth.pedidosPagos > 0 ? metaAds.gasto / growth.pedidosPagos : null;
  const margemAposMidia = growth.lucroOperacionalBruto - metaAds.gasto;

  const itens = [
    { rotulo: 'ROAS', valor: `${roas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}x`, ajuda: 'Faturamento ÷ gasto em anúncios' },
    { rotulo: 'Custo por pedido', valor: cpa === null ? '—' : moeda(cpa), ajuda: 'Gasto ÷ pedidos pagos' },
    { rotulo: 'Margem após mídia', valor: moeda(margemAposMidia), ajuda: 'Margem bruta − gasto em anúncios', negativo: margemAposMidia < 0 },
  ];

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-base font-bold uppercase tracking-wider text-[#1A1A1A]">Retorno sobre anúncios</h3>
      <p className="mt-0.5 text-[11px] font-medium text-zinc-500">
        Faturamento {textoPeriodo} cruzado com o gasto real na Meta. Inclui vendas que não vieram dos anúncios.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {itens.map((item) => (
          <div key={item.rotulo} className="min-w-0 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{item.rotulo}</div>
            <div className={`mt-1 truncate font-mono text-lg font-bold ${item.negativo ? 'text-red-600' : 'text-zinc-900'}`}>
              {item.valor}
            </div>
            <div className="mt-1 text-[10px] font-medium text-zinc-500">{item.ajuda}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
