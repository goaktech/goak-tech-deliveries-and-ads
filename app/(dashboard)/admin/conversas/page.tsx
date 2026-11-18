import Link from 'next/link';
import { ConversasWhatsapp } from '@/components/admin/ConversasWhatsapp';
import { obterRestauranteIdDoGestorLogado } from '@/utils/admin-auth';
import { ehAdminPlataforma } from '@/utils/plataforma-admin';
import { conversasDisponiveis, listarConversas, obterMensagensDaConversa } from '@/utils/whatsapp-conversas';
import { obterCredencialPlataforma } from '@/utils/whatsapp-envio';

export const revalidate = 0;

/** WhatsApp, cenário 5: conversas dos clientes desta loja com o número do Appetitoso. */
export default async function PaginaConversasAdmin({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const escopo = { tipo: 'loja' as const, restauranteId };
  const [disponivel, adminPlataforma] = await Promise.all([conversasDisponiveis(), ehAdminPlataforma()]);
  const conversas = disponivel ? await listarConversas(escopo) : [];
  const selecionada = c && conversas.some((conversa) => conversa.chave === c) ? c : null;
  const mensagens = selecionada ? await obterMensagensDaConversa(escopo, selecionada) : [];

  return (
    <section className="space-y-5 rounded-[24px] bg-white p-6 shadow-sm shadow-zinc-300/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Conversas</h1>
          <p className="max-w-2xl text-sm text-zinc-500">
            Mensagens que seus clientes mandaram para o WhatsApp do Appetitoso, ligadas ao último pedido de cada um na sua loja. Você
            pode responder até 24 h depois da última mensagem do cliente; a resposta sai do número do Appetitoso.
          </p>
        </div>
        {adminPlataforma ? (
          <Link href="/admin/whatsapp" className="text-sm font-bold text-[#E16349] hover:underline">
            WhatsApp do Appetitoso
          </Link>
        ) : null}
      </div>

      {disponivel ? (
        <ConversasWhatsapp
          conversas={conversas}
          selecionada={selecionada}
          mensagens={mensagens}
          envioConfigurado={Boolean(obterCredencialPlataforma())}
          caminho="/admin/conversas"
        />
      ) : (
        <p className="text-sm text-zinc-500">As conversas do WhatsApp ainda não foram ativadas nesta instalação.</p>
      )}
    </section>
  );
}
