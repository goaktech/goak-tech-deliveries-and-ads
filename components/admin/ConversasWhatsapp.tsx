'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { responderConversaWhatsapp } from '@/actions/adminWhatsappConversas';
import { estilosPainel } from '@/components/shared/estilosPainel';
import type { MensagemConversa, ResumoConversa } from '@/utils/whatsapp-conversas';

interface ConversasWhatsappProps {
  conversas: ResumoConversa[];
  /** Chave (DDD + 8 dígitos) da conversa aberta, vinda de ?c= na URL. */
  selecionada: string | null;
  mensagens: MensagemConversa[];
  /** Página da equipe Appetitoso: vê e responde todas as conversas. */
  comoPlataforma?: boolean;
  /** false enquanto o número do Appetitoso não estiver configurado no servidor. */
  envioConfigurado: boolean;
  caminho: string;
}

const ATUALIZAR_A_CADA_MS = 15_000;

const ROTULO_STATUS: Record<string, string> = { sent: 'Enviada', delivered: 'Entregue', read: 'Lida', failed: 'Não entregue' };

function formatarTelefone(digitos: string) {
  const local = digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digitos;
}

function quando(iso: string) {
  const data = new Date(iso);
  const hoje = new Date();
  const mesmoDia = data.toDateString() === hoje.toDateString();
  return mesmoDia
    ? data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
        ' ' +
        data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** WhatsApp, cenário 5: conversas dos clientes com o número do Appetitoso, com resposta dentro de 24 h. */
export function ConversasWhatsapp({ conversas, selecionada, mensagens, comoPlataforma = false, envioConfigurado, caminho }: ConversasWhatsappProps) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const fimRef = useRef<HTMLLIElement | null>(null);
  const aberta = conversas.find((c) => c.chave === selecionada) ?? null;

  // Novas mensagens chegam pelo webhook: a página se atualiza sozinha enquanto está aberta.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, ATUALIZAR_A_CADA_MS);
    return () => window.clearInterval(id);
  }, [router]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' });
  }, [selecionada, mensagens.length]);

  const responder = () => {
    if (!aberta) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await responderConversaWhatsapp({ chave: aberta.chave, texto, comoPlataforma });
      if (resultado.success) {
        setTexto('');
        router.refresh();
      } else {
        setErro(resultado.error);
      }
    });
  };

  if (!conversas.length) {
    return (
      <p className="rounded-2xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
        Nenhuma conversa nos últimos 30 dias. Quando um cliente responder uma mensagem do pedido no WhatsApp, a conversa aparece
        aqui.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <ul className={`space-y-1 ${aberta ? 'hidden md:block' : ''}`} aria-label="Conversas">
        {conversas.map((c) => {
          const ativa = c.chave === selecionada;
          return (
            <li key={c.chave}>
              <Link
                href={`${caminho}?c=${c.chave}`}
                scroll={false}
                aria-current={ativa ? 'true' : undefined}
                className={`block rounded-2xl px-3 py-3 transition-colors ${ativa ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-50'}`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-bold">{c.nome || formatarTelefone(c.telefone)}</span>
                  <span className={`shrink-0 text-[11px] ${ativa ? 'text-zinc-300' : 'text-zinc-400'}`}>{quando(c.ultimaEm)}</span>
                </span>
                <span className={`mt-0.5 block truncate text-xs ${ativa ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {c.ultimaDirecao === 'saida' ? 'Você: ' : ''}
                  {c.ultimaMensagem}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                  {c.janelaAberta ? (
                    <span className={ativa ? 'text-emerald-300' : 'text-emerald-600'}>Pode responder</span>
                  ) : (
                    <span className="text-zinc-400">Janela fechada</span>
                  )}
                  {c.numeroPedido ? <span className={ativa ? 'text-zinc-300' : 'text-zinc-500'}>Pedido #{c.numeroPedido}</span> : null}
                  {comoPlataforma ? (
                    <span className={ativa ? 'text-zinc-300' : 'text-zinc-500'}>{c.restauranteNome ?? 'Sem loja'}</span>
                  ) : null}
                  {c.veioDeAnuncio ? <span className={ativa ? 'text-amber-300' : 'text-amber-600'}>Anúncio</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {aberta ? (
        <section className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-100" aria-label={`Conversa com ${aberta.nome ?? formatarTelefone(aberta.telefone)}`}>
          <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
            <Link href={caminho} scroll={false} className="text-sm font-bold text-zinc-500 md:hidden" aria-label="Voltar para a lista">
              ←
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-zinc-900">{aberta.nome ?? formatarTelefone(aberta.telefone)}</p>
              <p className="text-xs text-zinc-500">
                {formatarTelefone(aberta.telefone)}
                {aberta.numeroPedido ? ` · pedido #${aberta.numeroPedido}` : ''}
                {comoPlataforma ? ` · ${aberta.restauranteNome ?? 'sem loja'}` : ''}
              </p>
            </div>
          </header>

          <ol className="flex-1 space-y-2 overflow-y-auto px-4 py-4" style={{ maxHeight: '60vh' }}>
            {mensagens.map((m) => (
              <li key={m.id} className={`flex ${m.direcao === 'saida' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.direcao === 'saida' ? 'bg-emerald-50 text-zinc-900' : 'bg-zinc-100 text-zinc-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.texto || `[${m.tipo}]`}</p>
                  <p className="mt-1 text-right text-[10px] text-zinc-500">
                    {quando(m.ocorridoEm)}
                    {m.direcao === 'saida' && m.status ? ` · ${ROTULO_STATUS[m.status] ?? m.status}` : ''}
                  </p>
                </div>
              </li>
            ))}
            <li ref={fimRef} aria-hidden="true" />
          </ol>

          <div className="space-y-2 border-t border-zinc-100 p-3">
            {!envioConfigurado ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                O envio pelo número do Appetitoso ainda está sendo configurado.
              </p>
            ) : !aberta.janelaAberta ? (
              <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                Passaram 24 h desde a última mensagem do cliente. Pela regra do WhatsApp, só dá para responder quando ele escrever de
                novo.
              </p>
            ) : (
              <form
                className="flex items-end gap-2"
                onSubmit={(evento) => {
                  evento.preventDefault();
                  responder();
                }}
              >
                <label htmlFor="resposta-whatsapp" className="sr-only">
                  Resposta
                </label>
                <textarea
                  id="resposta-whatsapp"
                  value={texto}
                  onChange={(evento) => setTexto(evento.target.value)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter' && !evento.shiftKey) {
                      evento.preventDefault();
                      if (texto.trim() && !pendente) responder();
                    }
                  }}
                  rows={2}
                  maxLength={4096}
                  placeholder="Escreva a resposta (Enter envia, Shift+Enter quebra a linha)"
                  className="min-h-[44px] flex-1 resize-y rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                />
                <button type="submit" disabled={pendente || !texto.trim()} className={estilosPainel.botaoEscuro}>
                  {pendente ? 'Enviando…' : 'Enviar'}
                </button>
              </form>
            )}
            {erro ? (
              <p className="text-xs font-medium text-red-600" role="alert">
                {erro}
              </p>
            ) : null}
          </div>
        </section>
      ) : (
        <p className="hidden items-center justify-center rounded-2xl border border-dashed border-zinc-200 text-sm text-zinc-400 md:flex">
          Escolha uma conversa.
        </p>
      )}
    </div>
  );
}
