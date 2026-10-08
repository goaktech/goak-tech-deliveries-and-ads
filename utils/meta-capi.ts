import { createHash } from 'node:crypto';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

// API de Conversões da Meta: envia o Purchase pelo servidor quando o pagamento é aprovado.
// Cada loja usa o próprio Pixel (restaurantes.meta_pixel_id) e o próprio token
// (restaurante_integracoes_meta_capi). Sem Pixel ou sem token, nada é enviado.
// O `event_id` é o id do pedido, o mesmo `eventID` do Pixel no navegador: a Meta junta os dois
// e conta a compra uma vez só.

const VERSAO_PADRAO = 'v25.0';
const TIMEOUT_MS = 6000;

function versaoApi(): string {
  return process.env.META_ADS_API_VERSION?.trim() || VERSAO_PADRAO;
}

function hash(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

function normalizarTexto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim().toLowerCase();
  return limpo || null;
}

function normalizarEmail(valor: unknown): string | null {
  const email = normalizarTexto(valor);
  return email && email.includes('@') ? email : null;
}

// Telefone só com dígitos e com DDI. Números brasileiros com 10 ou 11 dígitos ganham o 55.
export function normalizarTelefone(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  let digitos = valor.replace(/\D/g, '');
  if (digitos.startsWith('0')) digitos = digitos.replace(/^0+/, '');
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  return digitos.length >= 12 && digitos.length <= 13 ? digitos : null;
}

function separarNome(nome: unknown): { primeiro: string | null; ultimo: string | null } {
  const partes = (normalizarTexto(nome) ?? '').split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { primeiro: null, ultimo: null };
  return { primeiro: partes[0], ultimo: partes.length > 1 ? partes[partes.length - 1] : null };
}

function adicionar(dest: Record<string, unknown>, chave: string, valor: string | null) {
  if (valor) dest[chave] = [hash(valor)];
}

export interface DadosUsuarioCapi {
  nome?: unknown;
  telefone?: unknown;
  email?: unknown;
  cep?: unknown;
  fbp?: string | null;
  fbc?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

// Monta o `user_data`: dados pessoais com hash SHA-256, e fbp/fbc/IP/navegador em texto puro
// (como a Meta exige para esses campos).
export function montarUserData(dados: DadosUsuarioCapi): Record<string, unknown> {
  const userData: Record<string, unknown> = {};
  adicionar(userData, 'em', normalizarEmail(dados.email));
  adicionar(userData, 'ph', normalizarTelefone(dados.telefone));
  const { primeiro, ultimo } = separarNome(dados.nome);
  adicionar(userData, 'fn', primeiro);
  adicionar(userData, 'ln', ultimo);
  const cep = typeof dados.cep === 'string' ? dados.cep.replace(/\D/g, '') : '';
  adicionar(userData, 'zp', cep.length === 8 ? cep : null);
  adicionar(userData, 'country', 'br');
  if (dados.fbp) userData.fbp = dados.fbp;
  if (dados.fbc) userData.fbc = dados.fbc;
  if (dados.ip) userData.client_ip_address = dados.ip;
  if (dados.userAgent) userData.client_user_agent = dados.userAgent;
  return userData;
}

export interface ResultadoEnvioCapi {
  enviado: boolean;
  motivo?: 'sem_pixel' | 'sem_token' | 'pedido_nao_encontrado' | 'ja_enviado' | 'pedido_nao_pago' | 'falha';
  eventosRecebidos?: number;
  erro?: string;
}

interface PedidoCapi {
  id: string;
  restaurante_id: string;
  status: string;
  valor_total: number;
  codigo_acompanhamento: string;
  dados_cliente: {
    nome?: string;
    telefone?: string;
    email?: string;
    endereco?: { cep?: string };
  } | null;
  fb_browser_id: string | null;
  fb_click_id: string | null;
  fb_client_ip: string | null;
  fb_user_agent: string | null;
  capi_purchase_enviado_em: string | null;
  itens_pedido: Array<{ item_cardapio_id: string; quantidade: number; preco_unitario: number }> | null;
}

// Envia o Purchase de um pedido pago. Nunca lança: falha na Meta não pode derrubar o pagamento.
// A marca `capi_purchase_enviado_em` é reservada antes do envio (webhooks repetidos não duplicam)
// e liberada se o envio falhar, para a próxima tentativa.
export async function enviarPurchaseCapi(pedidoId: string): Promise<ResultadoEnvioCapi> {
  const supabase = createWebhookAdminClient();
  let reservou = false;
  try {
    const { data: pedido } = await supabase
      .from('pedidos')
      .select(
        'id, restaurante_id, status, valor_total, codigo_acompanhamento, dados_cliente, fb_browser_id, fb_click_id, fb_client_ip, fb_user_agent, capi_purchase_enviado_em, itens_pedido(item_cardapio_id, quantidade, preco_unitario)'
      )
      .eq('id', pedidoId)
      .maybeSingle<PedidoCapi>();

    if (!pedido) return { enviado: false, motivo: 'pedido_nao_encontrado' };
    if (pedido.status === 'PENDENTE' || pedido.status === 'CANCELADO') return { enviado: false, motivo: 'pedido_nao_pago' };
    if (pedido.capi_purchase_enviado_em) return { enviado: false, motivo: 'ja_enviado' };

    const [{ data: restaurante }, { data: integracao }] = await Promise.all([
      supabase.from('restaurantes').select('slug, meta_pixel_id').eq('id', pedido.restaurante_id).maybeSingle(),
      supabase
        .from('restaurante_integracoes_meta_capi')
        .select('access_token, test_event_code')
        .eq('restaurante_id', pedido.restaurante_id)
        .maybeSingle(),
    ]);

    const pixelId = restaurante?.meta_pixel_id?.trim();
    if (!pixelId) return { enviado: false, motivo: 'sem_pixel' };
    if (!integracao?.access_token) return { enviado: false, motivo: 'sem_token' };

    const { data: reserva } = await supabase
      .from('pedidos')
      .update({ capi_purchase_enviado_em: new Date().toISOString() })
      .eq('id', pedido.id)
      .is('capi_purchase_enviado_em', null)
      .select('id');
    if (!reserva || reserva.length === 0) return { enviado: false, motivo: 'ja_enviado' };
    reservou = true;

    const itens = pedido.itens_pedido ?? [];
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
    const evento = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: pedido.id,
      action_source: 'website',
      event_source_url: appUrl && restaurante?.slug ? `${appUrl}/${restaurante.slug}/acompanhar/${pedido.codigo_acompanhamento}` : undefined,
      user_data: montarUserData({
        nome: pedido.dados_cliente?.nome,
        telefone: pedido.dados_cliente?.telefone,
        email: pedido.dados_cliente?.email,
        cep: pedido.dados_cliente?.endereco?.cep,
        fbp: pedido.fb_browser_id,
        fbc: pedido.fb_click_id,
        ip: pedido.fb_client_ip,
        userAgent: pedido.fb_user_agent,
      }),
      custom_data: {
        currency: 'BRL',
        value: Number(pedido.valor_total),
        order_id: pedido.id,
        content_type: 'product',
        content_ids: itens.map((item) => item.item_cardapio_id),
        contents: itens.map((item) => ({ id: item.item_cardapio_id, quantity: item.quantidade, item_price: Number(item.preco_unitario) })),
      },
    };

    const corpo: Record<string, unknown> = { data: [evento] };
    if (integracao.test_event_code?.trim()) corpo.test_event_code = integracao.test_event_code.trim();

    const resposta = await fetch(
      `https://graph.facebook.com/${versaoApi()}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(integracao.access_token)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    const json = (await resposta.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string; code?: number } };

    if (!resposta.ok) {
      throw new Error(`Meta respondeu ${resposta.status}: ${json.error?.message ?? 'erro desconhecido'} (código ${json.error?.code ?? '?'})`);
    }
    return { enviado: true, eventosRecebidos: json.events_received };
  } catch (erro) {
    if (reservou) {
      await supabase.from('pedidos').update({ capi_purchase_enviado_em: null }).eq('id', pedidoId);
    }
    const mensagem = erro instanceof Error ? erro.message : 'Falha desconhecida';
    console.error('[meta-capi] Falha ao enviar Purchase', { pedidoId, mensagem });
    return { enviado: false, motivo: 'falha', erro: mensagem };
  }
}
