'use client';

import { useState, useTransition } from 'react';
import {
  adicionarDestinatarioAvisoVenda,
  alternarDestinatarioAvisoVenda,
  removerDestinatarioAvisoVenda,
} from '@/actions/adminWhatsappAvisos';
import { estilosPainel } from '@/components/shared/estilosPainel';
import type { AvisoVendaEnviado, DestinatarioAvisoVenda } from '@/utils/whatsapp-avisos-loja';

interface AvisosVendaWhatsappProps {
  destinatarios: DestinatarioAvisoVenda[];
  avisos: AvisoVendaEnviado[];
  /** false quando a migração das tabelas ainda não foi aplicada. */
  disponivel: boolean;
  /** false quando o número do Appetitoso ou o template de aviso ainda não foram configurados no servidor. */
  envioConfigurado: boolean;
}

const ROTULO_ENTREGA: Record<string, string> = {
  sent: 'Enviado',
  delivered: 'Entregue',
  read: 'Lido',
  failed: 'Falhou',
};

function formatarTelefone(digitos: string) {
  const local = digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digitos;
}

function situacaoAviso(aviso: AvisoVendaEnviado) {
  if (aviso.entrega_status) return ROTULO_ENTREGA[aviso.entrega_status] ?? aviso.entrega_status;
  return aviso.sucesso ? 'Enviado' : 'Não enviado';
}

/** WhatsApp, cenário 2: quem da loja recebe "Nova venda!" no WhatsApp quando um pedido é pago. */
export function AvisosVendaWhatsapp({ destinatarios, avisos, disponivel, envioConfigurado }: AvisosVendaWhatsappProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [consentimento, setConsentimento] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [pendente, startTransition] = useTransition();

  const executar = (acao: () => Promise<{ success: boolean; error?: string }>, sucesso: string, aoConcluir?: () => void) => {
    setMensagem(null);
    startTransition(async () => {
      const resultado = await acao();
      if (resultado.success) {
        setMensagem({ tipo: 'success', texto: sucesso });
        aoConcluir?.();
      } else {
        setMensagem({ tipo: 'error', texto: resultado.error ?? 'Algo deu errado. Tente de novo.' });
      }
    });
  };

  if (!disponivel) {
    return (
      <p className="text-sm text-zinc-500">
        Os avisos de venda no WhatsApp ainda não foram ativados nesta instalação.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Quando um pedido é pago, os números abaixo recebem no WhatsApp: loja, número do pedido, valor e nome do cliente.
        A mensagem sai do número do Appetitoso.
      </p>

      {!envioConfigurado ? (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          O envio ainda está sendo configurado pela equipe Appetitoso. Você já pode cadastrar os números.
        </div>
      ) : null}

      {destinatarios.length ? (
        <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
          {destinatarios.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">{d.nome}</div>
                <div className="text-xs text-zinc-500">
                  {formatarTelefone(d.telefone)} · {d.ativo ? 'recebendo' : 'pausado'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pendente}
                  className={estilosPainel.botaoSecundario}
                  onClick={() =>
                    executar(
                      () => alternarDestinatarioAvisoVenda(d.id, !d.ativo),
                      d.ativo ? `${d.nome} não recebe mais os avisos.` : `${d.nome} volta a receber os avisos.`
                    )
                  }
                >
                  {d.ativo ? 'Pausar' : 'Retomar'}
                </button>
                <button
                  type="button"
                  disabled={pendente}
                  className={estilosPainel.botaoPerigo}
                  onClick={() => executar(() => removerDestinatarioAvisoVenda(d.id), `${d.nome} foi removido.`)}
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">Ninguém da loja recebe os avisos ainda.</p>
      )}

      <div className="space-y-3 rounded-2xl border border-zinc-200 p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Adicionar número</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            aria-label="Nome"
            placeholder="Nome (ex.: Ana, gerente)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none"
          />
          <input
            aria-label="WhatsApp com DDD"
            type="tel"
            inputMode="tel"
            placeholder="(61) 99999-9999"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none"
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={consentimento}
            onChange={(e) => setConsentimento(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#1A1A1A]"
          />
          Essa pessoa concordou em receber os avisos de venda no WhatsApp.
        </label>
        <button
          type="button"
          disabled={pendente}
          className={estilosPainel.botaoEscuro}
          onClick={() =>
            executar(
              () => adicionarDestinatarioAvisoVenda({ nome, telefone, consentimento }),
              'Número adicionado. Ele recebe o próximo pedido pago.',
              () => {
                setNome('');
                setTelefone('');
                setConsentimento(false);
              }
            )
          }
        >
          {pendente ? 'Salvando…' : 'Adicionar'}
        </button>
      </div>

      {mensagem ? (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            mensagem.tipo === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      {avisos.length ? (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Últimos avisos</div>
          <ul className="space-y-1 text-sm text-zinc-600">
            {avisos.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  Pedido {a.pedido} → {a.destinatario}
                </span>
                <span className={a.entrega_status === 'failed' || !a.sucesso ? 'text-red-600' : 'text-zinc-500'}>
                  {situacaoAviso(a)} ·{' '}
                  {new Date(a.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
