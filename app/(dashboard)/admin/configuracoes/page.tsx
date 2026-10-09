import { ConfiguracaoTempoPreparo } from '@/components/admin/ConfiguracaoTempoPreparo';
import { ConfiguracaoEnderecoLoja } from '@/components/admin/ConfiguracaoEnderecoLoja';
import { ConfiguracaoHorarioFuncionamento } from '@/components/admin/ConfiguracaoHorarioFuncionamento';
import { ConfiguracaoFotoCapaLoja } from '@/components/admin/ConfiguracaoFotoCapaLoja';
import { ConfiguracaoImpressora } from '@/components/admin/ConfiguracaoImpressora';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import type { HorarioFuncionamentoDia } from '@/utils/horario-funcionamento';
import { normalizarLarguraPapel } from '@/utils/impressao';
import { createClient } from '@/utils/supabase/server';

export const revalidate = 0;

export default async function PainelConfiguracoesAdmin() {
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = createWebhookAdminClient();
  const [{ data: restaurante }, { data: dadosLogin }] = await Promise.all([
    supabase
    .from('restaurantes')
    .select(
      'nome, slug, email_corporativo, endereco, latitude, longitude, tempo_preparo_base_minutos, tempo_preparo_incremento_minutos, tempo_preparo_teto_minutos, horarios_funcionamento, foto_capa_url, largura_papel_impressao'
    )
    .eq('id', restauranteId)
    .maybeSingle(),
    createClient().then((cliente) => cliente.auth.getUser()),
  ]);
  // E-mail da loja; se ainda não foi cadastrado, mostra o e-mail do login do gestor.
  const emailLoja = restaurante?.email_corporativo?.trim() || dadosLogin?.user?.email || null;

  return (
    <>
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
            {emailLoja ? <div className="break-all text-sm text-zinc-500">{emailLoja}</div> : null}
            <div className="text-sm text-zinc-500">/{restaurante?.slug ?? ''}</div>
          </div>

          {/* Duas colunas a partir do tablet; no celular segue a ordem normal, uma embaixo da outra. */}
          <div className="space-y-5 md:columns-2 md:gap-5 md:space-y-0 [&>*]:break-inside-avoid md:[&>*]:mb-5">
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

          <ConfiguracaoImpressora larguraInicial={normalizarLarguraPapel(restaurante?.largura_papel_impressao)} />

          <ConfiguracaoFotoCapaLoja fotoCapaUrlInicial={restaurante?.foto_capa_url ?? null} />
          </div>
        </section>
    </>
  );
}
