import { notFound } from 'next/navigation';
import { ConversasWhatsapp } from '@/components/admin/ConversasWhatsapp';
import { ModelosWhatsapp } from '@/components/admin/ModelosWhatsapp';
import { SecaoRecolhivel } from '@/components/admin/SecaoRecolhivel';
import { estilosPainel } from '@/components/shared/estilosPainel';
import { ehAdminPlataforma } from '@/utils/plataforma-admin';
import {
  conversasDisponiveis,
  listarConversas,
  listarEventosComErro,
  obterMensagensDaConversa,
} from '@/utils/whatsapp-conversas';
import { obterCredencialPlataforma } from '@/utils/whatsapp-envio';
import { listarModelos, obterNumeroPlataforma, type ModeloWhatsapp, type NumeroWhatsappPlataforma } from '@/utils/whatsapp-modelos';

export const revalidate = 0;

const QUALIDADE: Record<string, string> = { GREEN: 'Alta', YELLOW: 'Média', RED: 'Baixa', UNKNOWN: 'Sem avaliação' };

function Item({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={ok ? 'text-emerald-600' : 'text-amber-600'} aria-hidden="true">
        {ok ? '✓' : '•'}
      </span>
      <span className={ok ? 'text-zinc-700' : 'text-zinc-900'}>
        {children}
        <span className="sr-only">{ok ? ' (feito)' : ' (falta)'}</span>
      </span>
    </li>
  );
}

/** WhatsApp do Appetitoso (só a equipe da plataforma): número, configuração, todas as conversas e modelos. */
export default async function PaginaWhatsappPlataforma({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  if (!(await ehAdminPlataforma())) notFound();

  const { c } = await searchParams;
  const escopo = { tipo: 'plataforma' as const };
  const cred = obterCredencialPlataforma();

  let numero: NumeroWhatsappPlataforma | null = null;
  let erroNumero: string | null = null;
  let modelos: ModeloWhatsapp[] = [];
  let erroModelos: string | null = null;
  if (cred) {
    try {
      numero = await obterNumeroPlataforma();
    } catch (erro) {
      erroNumero = erro instanceof Error ? erro.message : 'erro desconhecido';
    }
    try {
      modelos = await listarModelos();
    } catch (erro) {
      erroModelos = erro instanceof Error ? erro.message : 'erro desconhecido';
    }
  }

  const disponivel = await conversasDisponiveis();
  const conversas = disponivel ? await listarConversas(escopo) : [];
  const selecionada = c && conversas.some((conversa) => conversa.chave === c) ? c : null;
  const mensagens = selecionada ? await obterMensagensDaConversa(escopo, selecionada) : [];
  const eventosComErro = disponivel ? await listarEventosComErro() : [];
  const aprovado = (nome?: string) => Boolean(nome && modelos.some((m) => m.nome === nome && m.status === 'APPROVED'));

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-[24px] bg-white p-6 shadow-sm shadow-zinc-300/40">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">WhatsApp do Appetitoso</h1>
          <p className="max-w-2xl text-sm text-zinc-500">
            O número da plataforma manda os avisos de venda e de status dos pedidos e recebe as respostas dos clientes. Só a equipe
            Appetitoso vê esta página.
          </p>
        </div>

        {numero ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-bold text-zinc-900">{numero.telefone}</span>
            {numero.nomeVerificado ? <span className="text-sm text-zinc-600">{numero.nomeVerificado}</span> : null}
            <span className={numero.qualidade === 'GREEN' ? estilosPainel.seloSucesso : estilosPainel.seloAlerta}>
              Qualidade: {QUALIDADE[numero.qualidade ?? 'UNKNOWN'] ?? numero.qualidade}
            </span>
            {numero.statusNome ? <span className="text-xs text-zinc-500">Nome de exibição: {numero.statusNome}</span> : null}
          </div>
        ) : (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {cred ? `A Meta não respondeu sobre o número: ${erroNumero}` : 'O número do Appetitoso ainda não está configurado no servidor.'}
          </p>
        )}

        <ul className="space-y-1.5">
          <Item ok={Boolean(cred)}>Token e número no servidor (WHATSAPP_BUSINESS_ACCESS_TOKEN e WHATSAPP_BUSINESS_PHONE_NUMBER_ID)</Item>
          <Item ok={Boolean(cred?.wabaId)}>Conta do WhatsApp (WHATSAPP_BUSINESS_WABA_ID), para os modelos</Item>
          <Item ok={Boolean(process.env.WHATSAPP_META_APP_SECRET && process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)}>
            Webhook: segredo do app e token de verificação, com o campo &quot;messages&quot; assinado na Meta
          </Item>
          <Item ok={aprovado(process.env.WHATSAPP_TEMPLATE_STATUS_PEDIDO)}>
            Modelo de status do pedido aprovado (WHATSAPP_TEMPLATE_STATUS_PEDIDO)
          </Item>
          <Item ok={aprovado(process.env.WHATSAPP_TEMPLATE_AVISO_VENDA)}>Modelo de aviso de venda aprovado (WHATSAPP_TEMPLATE_AVISO_VENDA)</Item>
          <Item ok={disponivel}>Migração das conversas aplicada no banco</Item>
        </ul>

        {eventosComErro.length ? (
          <div className="space-y-1 rounded-xl bg-red-50 px-3 py-2">
            <p className="text-xs font-bold text-red-700">Últimos erros do webhook</p>
            <ul className="space-y-0.5">
              {eventosComErro.map((e) => (
                <li key={e.id} className="text-xs text-red-700">
                  {new Date(e.criado_em).toLocaleString('pt-BR')} · {e.campo ?? '—'} · {e.erro}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-[24px] bg-white p-6 shadow-sm shadow-zinc-300/40">
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold text-zinc-900">Todas as conversas</h2>
          <p className="text-sm text-zinc-500">
            Inclui as que não têm loja (o cliente não fez pedido nos últimos 60 dias). As de cada loja também aparecem em Conversas,
            no painel dela.
          </p>
        </div>
        {disponivel ? (
          <ConversasWhatsapp
            conversas={conversas}
            selecionada={selecionada}
            mensagens={mensagens}
            comoPlataforma
            envioConfigurado={Boolean(cred)}
            caminho="/admin/whatsapp"
          />
        ) : (
          <p className="text-sm text-zinc-500">Aplique a migração 20261118120000_whatsapp_conversas para ativar as conversas.</p>
        )}
      </section>

      <SecaoRecolhivel id="modelos" titulo="Modelos de mensagem" abertaInicialmente>
        {cred?.wabaId ? (
          <ModelosWhatsapp modelos={modelos} erroLista={erroModelos} />
        ) : (
          <p className="text-sm text-zinc-500">Configure WHATSAPP_BUSINESS_WABA_ID no servidor para ver e criar os modelos.</p>
        )}
      </SecaoRecolhivel>
    </div>
  );
}
