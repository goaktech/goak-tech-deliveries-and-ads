import { ConfiguracaoFormasPagamento } from '@/components/admin/ConfiguracaoFormasPagamento';
import { ConfiguracaoPixelFacebook } from '@/components/admin/ConfiguracaoPixelFacebook';
import { ConfiguracaoMetaCapi } from '@/components/admin/ConfiguracaoMetaCapi';
import { ConfiguracaoIfoodEntrega } from '@/components/admin/ConfiguracaoIfoodEntrega';
import {
  obterIntegracaoMercadoPagoPorRestauranteId,
  obterRestauranteIdDoGestorLogado,
} from '@/utils/mercado-pago';
import { obterIntegracaoWhatsappBusinessPorRestauranteId } from '@/utils/whatsapp-business';
import { avaliarTokenMetaAds, obterIntegracaoMetaAdsPorRestauranteId } from '@/utils/meta-ads';
import { ConfiguracaoMetaAds } from '@/components/admin/ConfiguracaoMetaAds';
import { obterIntegracaoIfoodPorRestauranteId, paraIntegracaoIfoodPublica } from '@/utils/ifood';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

export const revalidate = 0;

function classeBadgeIntegracao(status: string | null | undefined): string {
  return status === 'conectado'
    ? 'rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600'
    : 'rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-600';
}

const MENSAGENS_META_ADS: Record<string, { tipo: 'success' | 'error' | 'info'; texto: string }> = {
  'meta-ads-conectado': { tipo: 'success', texto: 'Meta Ads conectado com sucesso.' },
  'meta-ads-desconectado': { tipo: 'info', texto: 'Meta Ads desconectado. O acesso foi revogado na Meta.' },
  'meta-ads-cancelado': { tipo: 'info', texto: 'Conexão com o Meta Ads cancelada. Nada foi alterado.' },
};

const MOTIVOS_ERRO_META_ADS: Record<string, string> = {
  'estado-invalido': 'A sessão de conexão expirou ou é inválida. Clique em Conectar Meta Ads e tente de novo.',
  'sem-conta': 'Nenhuma conta de anúncios foi encontrada para este usuário da Meta.',
  token: 'A Meta não liberou o acesso de longa duração. Tente conectar novamente.',
  erro: 'Não foi possível concluir a conexão com o Meta Ads. Tente novamente em instantes.',
};

function mensagemStatusMetaAds(status?: string, motivo?: string) {
  if (status === 'meta-ads-erro') {
    return { tipo: 'error' as const, texto: MOTIVOS_ERRO_META_ADS[motivo ?? ''] ?? MOTIVOS_ERRO_META_ADS.erro };
  }
  return status ? MENSAGENS_META_ADS[status] ?? null : null;
}

interface PainelIntegracoesAdminProps {
  searchParams?: Promise<{ status?: string; motivo?: string }>;
}

export default async function PainelIntegracoesAdmin({ searchParams }: PainelIntegracoesAdminProps) {
  const parametros = (await searchParams) ?? {};
  const mensagemMetaAds = mensagemStatusMetaAds(parametros.status, parametros.motivo);
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = createWebhookAdminClient();

  // As consultas não dependem umas das outras, então rodam juntas (e não em fila).
  const [
    { data: restaurante },
    integracao,
    integracaoWhatsapp,
    integracaoMetaAds,
    { data: integracaoCapi },
    integracaoIfood,
  ] = await Promise.all([
    supabase
      .from('restaurantes')
      .select('nome, slug, meta_pixel_id, formas_pagamento_aceitas, endereco, latitude, longitude')
      .eq('id', restauranteId)
      .maybeSingle(),
    obterIntegracaoMercadoPagoPorRestauranteId(restauranteId),
    obterIntegracaoWhatsappBusinessPorRestauranteId(restauranteId),
    obterIntegracaoMetaAdsPorRestauranteId(restauranteId),
    // Só informa se há token da API de Conversões; o valor nunca sai do servidor.
    supabase
      .from('restaurante_integracoes_meta_capi')
      .select('test_event_code')
      .eq('restaurante_id', restauranteId)
      .maybeSingle(),
    // Falha aqui (ex.: tabela ainda não criada no Supabase) não pode derrubar as outras integrações.
    obterIntegracaoIfoodPorRestauranteId(restauranteId)
      .then(paraIntegracaoIfoodPublica)
      .catch((erro) => {
        console.error('Falha ao carregar integração iFood:', erro);
        return null;
      }),
  ]);
  const tokenMetaAds = avaliarTokenMetaAds(integracaoMetaAds);

  return (
    <>
        <section className="bg-white rounded-[24px] p-6 shadow-sm shadow-zinc-300/40 space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Pagamentos e Integrações</h1>
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

          <ConfiguracaoFormasPagamento formasIniciais={restaurante?.formas_pagamento_aceitas} />

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

          {mensagemMetaAds ? (
            <div
              className={`rounded-xl px-3 py-2 text-xs font-medium ${
                mensagemMetaAds.tipo === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : mensagemMetaAds.tipo === 'error'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-zinc-100 text-zinc-700'
              }`}
            >
              {mensagemMetaAds.texto}
            </div>
          ) : null}

          <ConfiguracaoMetaAds
            situacao={
              tokenMetaAds.estado === 'expirado'
                ? 'reconectar'
                : tokenMetaAds.estado === 'ausente'
                  ? integracaoMetaAds?.connection_status === 'desconectado'
                    ? 'desconectado'
                    : 'pendente'
                  : 'conectado'
            }
            diasParaExpirar={tokenMetaAds.estado === 'expirando' ? tokenMetaAds.diasRestantes : null}
            contaNome={integracaoMetaAds?.ad_account_name ?? null}
            contaMoeda={integracaoMetaAds?.ad_account_currency ?? null}
          />

          <ConfiguracaoIfoodEntrega
            integracaoInicial={integracaoIfood}
            enderecoLoja={restaurante?.endereco ?? null}
            latitudeLoja={restaurante?.latitude ?? null}
            longitudeLoja={restaurante?.longitude ?? null}
          />

          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-5 text-sm text-zinc-500 min-w-0">
            Callbacks: <span className="font-mono break-all">/api/admin/integracoes/mercado-pago/callback</span>,{' '}
            <span className="font-mono break-all">/api/admin/integracoes/whatsapp-business/callback</span> e{' '}
            <span className="font-mono break-all">/api/admin/integracoes/meta-ads/callback</span>. No app da Meta: desautorização em{' '}
            <span className="font-mono break-all">/api/webhooks/meta-ads/desautorizar</span> e exclusão de dados em{' '}
            <span className="font-mono break-all">/api/webhooks/meta-ads/exclusao-dados</span>.
          </div>

          <ConfiguracaoPixelFacebook pixelIdInicial={restaurante?.meta_pixel_id ?? null} />

          <ConfiguracaoMetaCapi
            temPixel={Boolean(restaurante?.meta_pixel_id)}
            configurado={Boolean(integracaoCapi)}
            codigoTesteInicial={integracaoCapi?.test_event_code ?? null}
          />
        </section>
    </>
  );
}
