import { AdminNavHeader } from '@/components/admin/AdminNavHeader';
import { ConfiguracaoTempoPreparo } from '@/components/admin/ConfiguracaoTempoPreparo';
import { ConfiguracaoEnderecoLoja } from '@/components/admin/ConfiguracaoEnderecoLoja';
import { ConfiguracaoHorarioFuncionamento } from '@/components/admin/ConfiguracaoHorarioFuncionamento';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import type { HorarioFuncionamentoDia } from '@/utils/horario-funcionamento';

export const revalidate = 0;

export default async function PainelConfiguracoesAdmin() {
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = createWebhookAdminClient();
  const { data: restaurante } = await supabase
    .from('restaurantes')
    .select(
      'nome, slug, endereco, latitude, longitude, tempo_preparo_base_minutos, tempo_preparo_incremento_minutos, tempo_preparo_teto_minutos, horarios_funcionamento'
    )
    .eq('id', restauranteId)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-[#F3F3F3] text-[#1A1A1A] font-sans antialiased flex items-start justify-center p-4 sm:p-8 md:py-12">
      <div className="w-full max-w-4xl space-y-6">
        <AdminNavHeader activeTab="configuracoes" />

        <section className="bg-white rounded-[24px] p-6 shadow-sm shadow-zinc-300/40 space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Configurações da loja</h1>
            <p className="text-sm text-zinc-500">
              Ajustes que afetam como sua loja se comporta pro cliente — hoje, a estimativa de tempo de preparo.
            </p>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Estabelecimento</div>
            <div className="text-lg font-semibold text-zinc-900">{restaurante?.nome ?? 'Estabelecimento'}</div>
            <div className="text-sm text-zinc-500">/{restaurante?.slug ?? ''}</div>
          </div>

          <ConfiguracaoEnderecoLoja
            enderecoInicial={restaurante?.endereco ?? ''}
            latitudeInicial={restaurante?.latitude ?? null}
            longitudeInicial={restaurante?.longitude ?? null}
          />

          <ConfiguracaoTempoPreparo
            tempoPreparoBaseMinutosInicial={restaurante?.tempo_preparo_base_minutos ?? 20}
            tempoPreparoIncrementoMinutosInicial={restaurante?.tempo_preparo_incremento_minutos ?? 3}
            tempoPreparoTetoMinutosInicial={restaurante?.tempo_preparo_teto_minutos ?? 60}
          />

          <ConfiguracaoHorarioFuncionamento
            horariosIniciais={(restaurante?.horarios_funcionamento as HorarioFuncionamentoDia[] | null) ?? null}
          />
        </section>
      </div>
    </div>
  );
}
