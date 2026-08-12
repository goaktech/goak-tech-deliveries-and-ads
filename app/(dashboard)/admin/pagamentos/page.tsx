import { AdminNavHeader } from '@/components/admin/AdminNavHeader';
import { ConfiguracaoPixelFacebook } from '@/components/admin/ConfiguracaoPixelFacebook';
import {
  obterIntegracaoMercadoPagoPorRestauranteId,
  obterRestauranteIdDoGestorLogado,
} from '@/utils/mercado-pago';
import { obterIntegracaoWhatsappBusinessPorRestauranteId } from '@/utils/whatsapp-business';
import { obterIntegracaoMetaAdsPorRestauranteId } from '@/utils/meta-ads';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

export const revalidate = 0;

function classeBadgeIntegracao(status: string | null | undefined): string {
  return status === 'conectado'
    ? 'rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600'
    : 'rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-600';
}

export default async function PainelPagamentosAdmin() {
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = createWebhookAdminClient();
  const { data: restaurante } = await supabase
    .from('restaurantes')
    .select('nome, slug, meta_pixel_id')
    .eq('id', restauranteId)
    .maybeSingle();

  const integracao = await obterIntegracaoMercadoPagoPorRestauranteId(restauranteId);
  const integracaoWhatsapp = await obterIntegracaoWhatsappBusinessPorRestauranteId(restauranteId);
  const integracaoMetaAds = await obterIntegracaoMetaAdsPorRestauranteId(restauranteId);

  return (
    <div className="min-h-screen bg-[#F3F3F3] text-[#1A1A1A] font-sans antialiased flex items-start justify-center p-4 sm:p-8 md:py-12">
      <div className="w-full max-w-4xl space-y-6">
        <AdminNavHeader activeTab="pagamentos" />

        <section className="bg-white rounded-[24px] p-6 shadow-sm shadow-zinc-300/40 space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Integrações de pagamento</h1>
            <p className="text-sm text-zinc-500">
              Conecte a conta do Mercado Pago do estabelecimento para processar PIX e cartão com o dinheiro caindo na conta do lojista.
            </p>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Estabelecimento</div>
            <div className="text-lg font-semibold text-zinc-900">{restaurante?.nome ?? 'Estabelecimento'}</div>
            <div className="text-sm text-zinc-500">/{restaurante?.slug ?? ''}</div>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Mercado Pago</div>
                <div className="text-lg font-semibold text-zinc-900">
                  {integracao?.connection_status === 'conectado' ? 'Conta conectada' : 'Conta não conectada'}
                </div>
              </div>
              <span className={classeBadgeIntegracao(integracao?.connection_status)}>
                {integracao?.connection_status ?? 'pendente'}
              </span>
            </div>

            <div className="text-sm text-zinc-600">
              {integracao?.account_email ? `Conta vinculada: ${integracao.account_email}` : 'Nenhuma conta vinculada ainda.'}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <form action="/api/admin/integracoes/mercado-pago/conectar" method="get">
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white"
                >
                  Conectar Mercado Pago
                </button>
              </form>

              <form action="/api/admin/integracoes/mercado-pago/desconectar" method="post">
                <button
                  type="submit"
                  className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-zinc-700"
                >
                  Desconectar
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">WhatsApp Business</div>
                <div className="text-lg font-semibold text-zinc-900">
                  {integracaoWhatsapp?.connection_status === 'conectado' ? 'Conta conectada' : 'Conta não conectada'}
                </div>
              </div>
              <span className={classeBadgeIntegracao(integracaoWhatsapp?.connection_status)}>
                {integracaoWhatsapp?.connection_status ?? 'pendente'}
              </span>
            </div>

            <div className="space-y-1 text-sm text-zinc-600">
              <div>
                {integracaoWhatsapp?.display_phone_number
                  ? `Número vinculado: ${integracaoWhatsapp.display_phone_number}`
                  : 'Nenhum número vinculado ainda.'}
              </div>
              <div>
                {integracaoWhatsapp?.template_name
                  ? `Template: ${integracaoWhatsapp.template_name} (${integracaoWhatsapp.template_status ?? 'desconhecido'})`
                  : 'Template de status ainda não configurado.'}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <form action="/api/admin/integracoes/whatsapp-business/conectar" method="get">
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white"
                >
                  Conectar WhatsApp
                </button>
              </form>

              <form action="/api/admin/integracoes/whatsapp-business/desconectar" method="post">
                <button
                  type="submit"
                  className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-zinc-700"
                >
                  Desconectar
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Meta Ads</div>
                <div className="text-lg font-semibold text-zinc-900">
                  {integracaoMetaAds?.connection_status === 'conectado' ? 'Conta conectada' : 'Conta não conectada'}
                </div>
              </div>
              <span className={classeBadgeIntegracao(integracaoMetaAds?.connection_status)}>
                {integracaoMetaAds?.connection_status ?? 'pendente'}
              </span>
            </div>

            <div className="text-sm text-zinc-600">
              {integracaoMetaAds?.ad_account_name
                ? `Conta de anúncios vinculada: ${integracaoMetaAds.ad_account_name}`
                : 'Nenhuma conta de anúncios vinculada ainda.'}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <form action="/api/admin/integracoes/meta-ads/conectar" method="get">
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white"
                >
                  Conectar Meta Ads
                </button>
              </form>

              <form action="/api/admin/integracoes/meta-ads/desconectar" method="post">
                <button
                  type="submit"
                  className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-zinc-700"
                >
                  Desconectar
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-5 text-sm text-zinc-500">
            Callbacks: <span className="font-mono">/api/admin/integracoes/mercado-pago/callback</span>,{' '}
            <span className="font-mono">/api/admin/integracoes/whatsapp-business/callback</span> e{' '}
            <span className="font-mono">/api/admin/integracoes/meta-ads/callback</span>.
          </div>

          <ConfiguracaoPixelFacebook pixelIdInicial={restaurante?.meta_pixel_id ?? null} />
        </section>
      </div>
    </div>
  );
}
