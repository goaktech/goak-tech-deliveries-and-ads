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
import { SecaoRecolhivel } from '@/components/admin/SecaoRecolhivel';
import { FormularioConfirmavel } from '@/components/shared/FormularioConfirmavel';
import { estilosPainel } from '@/components/shared/estilosPainel';

export const revalidate = 0;

function classeBadgeIntegracao(status: string | null | undefined): string {
  return status === 'conectado' ? estilosPainel.seloSucesso : status === 'pendente' || !status ? estilosPainel.seloAlerta : estilosPainel.seloErro;
}

const ROTULO_STATUS: Record<string, string> = {
  conectado: 'Conectado',
  pendente: 'Pendente',
  desconectado: 'Desconectado',
};

function rotuloStatus(status: string | null | undefined): string {
  return ROTULO_STATUS[status ?? 'pendente'] ?? status ?? 'Pendente';
}

interface ItemResumo {
  ancora: string;
  nome: string;
  ok: boolean;
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
  const mpConectado = integracao?.connection_status === 'conectado';
  const waConectado = integracaoWhatsapp?.connection_status === 'conectado';
  const resumo: ItemResumo[] = [
    { ancora: 'mercado-pago', nome: 'Mercado Pago', ok: mpConectado },
    { ancora: 'whatsapp', nome: 'WhatsApp', ok: waConectado },
    { ancora: 'meta-ads', nome: 'Meta Ads', ok: tokenMetaAds.estado !== 'ausente' && tokenMetaAds.estado !== 'expirado' },
    { ancora: 'ifood', nome: 'iFood', ok: integracaoIfood?.connectionStatus === 'conectado' },
    { ancora: 'pixel', nome: 'Pixel', ok: Boolean(restaurante?.meta_pixel_id) },
    { ancora: 'capi', nome: 'API de Conversões', ok: Boolean(integracaoCapi) },
  ];

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

          <nav aria-label="Resumo das integrações" className="flex flex-wrap gap-2">
            {resumo.map((item) => (
              <a
                key={item.ancora}
                href={`#${item.ancora}`}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition sm:min-h-9 ${
                  item.ok
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                }`}
              >
                <span aria-hidden className={`h-2 w-2 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                {item.nome}
                <span className="sr-only">{item.ok ? ' conectado' : ' não configurado'}</span>
              </a>
            ))}
          </nav>

          <SecaoRecolhivel
            id="mercado-pago"
            titulo="Mercado Pago"
            selo={<span className={classeBadgeIntegracao(integracao?.connection_status)}>{rotuloStatus(integracao?.connection_status)}</span>}
          >
            <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 md:border-0 md:p-1">
              <div className="text-lg font-semibold text-zinc-900">{mpConectado ? 'Conta conectada' : 'Conta não conectada'}</div>

              <div className="text-sm text-zinc-600">
                {integracao?.account_email ? `Conta vinculada: ${integracao.account_email}` : 'Nenhuma conta vinculada ainda.'}
              </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <form action="/api/admin/integracoes/mercado-pago/conectar" method="get">
                <button type="submit" className={mpConectado ? estilosPainel.botaoSecundario : estilosPainel.botaoEscuro}>
                  {mpConectado ? 'Reconectar' : 'Conectar Mercado Pago'}
                </button>
              </form>

              {mpConectado ? (
                <FormularioConfirmavel
                  action="/api/admin/integracoes/mercado-pago/desconectar"
                  method="post"
                  confirmacao={{
                    titulo: 'Desconectar o Mercado Pago?',
                    mensagem: 'A loja deixa de receber pagamentos por PIX e cartão até você conectar de novo.',
                    rotuloConfirmar: 'Desconectar',
                    perigo: true,
                  }}
                >
                  <button type="submit" className={estilosPainel.botaoPerigo}>
                    Desconectar
                  </button>
                </FormularioConfirmavel>
              ) : null}
            </div>
            </div>
          </SecaoRecolhivel>

          <SecaoRecolhivel id="formas-pagamento" titulo="Formas de pagamento da loja">
            <ConfiguracaoFormasPagamento formasIniciais={restaurante?.formas_pagamento_aceitas} />
          </SecaoRecolhivel>

          <SecaoRecolhivel
            id="whatsapp"
            titulo="WhatsApp Business"
            selo={<span className={classeBadgeIntegracao(integracaoWhatsapp?.connection_status)}>{rotuloStatus(integracaoWhatsapp?.connection_status)}</span>}
          >
            <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 md:border-0 md:p-1">
              <div className="text-lg font-semibold text-zinc-900">{waConectado ? 'Conta conectada' : 'Conta não conectada'}</div>

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
                <button type="submit" className={waConectado ? estilosPainel.botaoSecundario : estilosPainel.botaoEscuro}>
                  {waConectado ? 'Reconectar' : 'Conectar WhatsApp'}
                </button>
              </form>

              {waConectado ? (
                <FormularioConfirmavel
                  action="/api/admin/integracoes/whatsapp-business/desconectar"
                  method="post"
                  confirmacao={{
                    titulo: 'Desconectar o WhatsApp?',
                    mensagem: 'Os clientes deixam de receber o aviso de status do pedido por WhatsApp.',
                    rotuloConfirmar: 'Desconectar',
                    perigo: true,
                  }}
                >
                  <button type="submit" className={estilosPainel.botaoPerigo}>
                    Desconectar
                  </button>
                </FormularioConfirmavel>
              ) : null}
            </div>
            </div>
          </SecaoRecolhivel>

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

          <SecaoRecolhivel id="meta-ads" titulo="Meta Ads">
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
          </SecaoRecolhivel>

          <SecaoRecolhivel id="ifood" titulo="iFood Entrega">
          <ConfiguracaoIfoodEntrega
            integracaoInicial={integracaoIfood}
            enderecoLoja={restaurante?.endereco ?? null}
            latitudeLoja={restaurante?.latitude ?? null}
            longitudeLoja={restaurante?.longitude ?? null}
          />
          </SecaoRecolhivel>

          <details className="rounded-2xl border border-dashed border-zinc-200 bg-white p-4 text-sm text-zinc-500 min-w-0">
            <summary className="min-h-11 cursor-pointer text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:min-h-0">Endereços técnicos (para configurar apps)</summary>
            <p className="mt-2">Callbacks: <span className="font-mono break-all">/api/admin/integracoes/mercado-pago/callback</span>,{' '}
            <span className="font-mono break-all">/api/admin/integracoes/whatsapp-business/callback</span> e{' '}
            <span className="font-mono break-all">/api/admin/integracoes/meta-ads/callback</span>. No app da Meta: desautorização em{' '}
            <span className="font-mono break-all">/api/webhooks/meta-ads/desautorizar</span> e exclusão de dados em{' '}
            <span className="font-mono break-all">/api/webhooks/meta-ads/exclusao-dados</span>.</p>
          </details>

          <SecaoRecolhivel id="pixel" titulo="Meta Pixel">
          <ConfiguracaoPixelFacebook pixelIdInicial={restaurante?.meta_pixel_id ?? null} />
          </SecaoRecolhivel>

          <SecaoRecolhivel id="capi" titulo="Meta API de Conversões">
          <ConfiguracaoMetaCapi
            temPixel={Boolean(restaurante?.meta_pixel_id)}
            configurado={Boolean(integracaoCapi)}
            codigoTesteInicial={integracaoCapi?.test_event_code ?? null}
          />
          </SecaoRecolhivel>
        </section>
    </>
  );
}
