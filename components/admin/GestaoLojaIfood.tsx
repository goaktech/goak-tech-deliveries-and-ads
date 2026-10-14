'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  consultarHorariosIfoodAction,
  criarPausaIfoodAction,
  detalharLojaIfoodAction,
  listarLojasVinculadasAction,
  listarPausasIfoodAction,
  removerPausaIfoodAction,
  salvarHorariosIfoodAction,
} from '@/actions/adminIfoodLoja';
import { useAvisosPainel } from '@/components/shared/AvisosPainel';
import type { StatusOperacaoIfood } from '@/utils/ifood';
import type { DetalhesLojaIfood, DiaSemanaIfood, LojaVinculadaIfood, PausaIfood, TurnoIfood } from '@/utils/ifood-merchant';

type Mensagem = { tipo: 'success' | 'error'; texto: string } | null;
type TurnoEditavel = { inicio: string; fim: string };

const DIAS: Array<{ id: DiaSemanaIfood; rotulo: string }> = [
  { id: 'MONDAY', rotulo: 'Segunda' },
  { id: 'TUESDAY', rotulo: 'Terça' },
  { id: 'WEDNESDAY', rotulo: 'Quarta' },
  { id: 'THURSDAY', rotulo: 'Quinta' },
  { id: 'FRIDAY', rotulo: 'Sexta' },
  { id: 'SATURDAY', rotulo: 'Sábado' },
  { id: 'SUNDAY', rotulo: 'Domingo' },
];

const ROTULO_STATUS_LOJA: Record<string, string> = {
  AVAILABLE: 'Disponível',
  UNAVAILABLE: 'Indisponível',
  DISABLED: 'Desativada',
};

const ROTULO_ESTADO: Record<string, string> = {
  OK: 'Aberta',
  WARNING: 'Aberta com alerta',
  CLOSED: 'Fechada',
  ERROR: 'Com problema',
};

const FORMATO_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

const CLASSE_BOTAO =
  'rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50';
const CLASSE_BOTAO_SECUNDARIO =
  'rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-zinc-700 disabled:opacity-50';
const CLASSE_INPUT =
  'rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none';

function dataHora(iso: string | null) {
  if (!iso) {
    return '—';
  }
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? iso : FORMATO_DATA_HORA.format(data);
}

/** "AAAA-MM-DDTHH:MM" no horário de Brasília, como as pausas do iFood usam. */
function paraInputBrasilia(data: Date) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(data)
      .map((parte) => [parte.type, parte.value])
  );
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
}

/** Hora de pausa do iFood (Brasília, sem fuso) como "DD/MM/AAAA, HH:MM". */
function dataHoraPausa(local: string) {
  const [data, hora = ''] = local.split('T');
  const [ano, mes, dia] = data.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}, ${hora.slice(0, 5)}` : local;
}

function fimDoTurno(turno: TurnoIfood) {
  const [h, m] = turno.inicio.split(':').map(Number);
  const total = h * 60 + m + turno.duracaoMinutos;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function turnosParaEdicao(turnos: TurnoIfood[]) {
  const porDia = Object.fromEntries(DIAS.map((dia) => [dia.id, [] as TurnoEditavel[]])) as Record<DiaSemanaIfood, TurnoEditavel[]>;
  for (const turno of turnos) {
    porDia[turno.dia].push({ inicio: turno.inicio, fim: fimDoTurno(turno) });
  }
  return porDia;
}

function Aviso({ mensagem }: { mensagem: Mensagem }) {
  if (!mensagem) {
    return null;
  }
  return (
    <div
      className={`rounded-xl px-3 py-2 text-xs font-medium ${
        mensagem.tipo === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      }`}
    >
      {mensagem.texto}
    </div>
  );
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
      <div>
        <b className="text-zinc-900">{titulo}</b>
        <div className="text-xs text-zinc-500">{descricao}</div>
      </div>
      {children}
    </div>
  );
}

// ------------------------------------------------------------ Cenário 1

function LojasVinculadas() {
  const [lojas, setLojas] = useState<LojaVinculadaIfood[] | null>(null);
  const [conectadaId, setConectadaId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<{
    detalhes: DetalhesLojaIfood;
    status: StatusOperacaoIfood[];
    consultadoEm: string;
  } | null>(null);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem>(null);

  const listar = async () => {
    setCarregando('lista');
    setMensagem(null);
    const resultado = await listarLojasVinculadasAction();
    if (resultado.success) {
      setLojas(resultado.lojas);
      setConectadaId(resultado.conectadaId);
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error });
    }
    setCarregando(null);
  };

  const detalhar = async (lojaId: string) => {
    setCarregando(lojaId);
    setMensagem(null);
    const resultado = await detalharLojaIfoodAction(lojaId);
    if (resultado.success) {
      setDetalhe({ detalhes: resultado.detalhes, status: resultado.status, consultadoEm: resultado.consultadoEm });
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error });
    }
    setCarregando(null);
  };

  const d = detalhe?.detalhes;

  return (
    <Secao titulo="Lojas vinculadas" descricao="Lojas do iFood que autorizaram o goak, com detalhes e disponibilidade.">
      <button type="button" onClick={listar} disabled={!!carregando} className={CLASSE_BOTAO}>
        {carregando === 'lista' ? 'Listando...' : 'Listar lojas vinculadas'}
      </button>

      {lojas ? (
        lojas.length === 0 ? (
          <div className="text-xs text-zinc-500">Nenhuma loja vinculada a este token.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="py-1.5 pr-3">Loja</th>
                  <th className="py-1.5 pr-3">Razão social</th>
                  <th className="py-1.5 pr-3">ID</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {lojas.map((loja) => (
                  <tr key={loja.id}>
                    <td className="py-2 pr-3 font-semibold text-zinc-900">
                      {loja.nome ?? '—'}
                      {loja.id === conectadaId ? (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                          conectada
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{loja.razaoSocial ?? '—'}</td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{loja.id}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => detalhar(loja.id)}
                        disabled={!!carregando}
                        className={CLASSE_BOTAO_SECUNDARIO}
                      >
                        {carregando === loja.id ? 'Consultando...' : 'Detalhes'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {d && detalhe ? (
        <div className="space-y-3 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700">
          <div className="flex items-center justify-between gap-2">
            <b className="text-sm text-zinc-900">{d.nome ?? d.id}</b>
            <button type="button" onClick={() => setDetalhe(null)} className="text-[11px] font-bold uppercase text-zinc-500">
              Fechar
            </button>
          </div>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            <div><dt className="inline text-zinc-400">ID: </dt><dd className="inline font-mono">{d.id}</dd></div>
            <div><dt className="inline text-zinc-400">Razão social: </dt><dd className="inline">{d.razaoSocial ?? '—'}</dd></div>
            <div><dt className="inline text-zinc-400">Situação: </dt><dd className="inline">{ROTULO_STATUS_LOJA[d.status ?? ''] ?? d.status ?? '—'}</dd></div>
            <div><dt className="inline text-zinc-400">Tipo: </dt><dd className="inline">{d.tipo ?? '—'}</dd></div>
            <div><dt className="inline text-zinc-400">Descrição: </dt><dd className="inline">{d.descricao || '—'}</dd></div>
            <div>
              <dt className="inline text-zinc-400">Ticket médio: </dt>
              <dd className="inline">
                {d.ticketMedio != null ? d.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
              </dd>
            </div>
            <div><dt className="inline text-zinc-400">Exclusiva: </dt><dd className="inline">{d.exclusiva == null ? '—' : d.exclusiva ? 'Sim' : 'Não'}</dd></div>
            <div><dt className="inline text-zinc-400">Cadastrada em: </dt><dd className="inline">{dataHora(d.criadaEm)}</dd></div>
            <div className="sm:col-span-2">
              <dt className="inline text-zinc-400">Endereço: </dt>
              <dd className="inline">
                {[d.endereco.logradouro, d.endereco.numero, d.endereco.bairro, d.endereco.cidade, d.endereco.estado, d.endereco.cep, d.endereco.pais]
                  .filter(Boolean)
                  .join(', ') || '—'}
                {d.endereco.latitude != null && d.endereco.longitude != null
                  ? ` (${d.endereco.latitude}, ${d.endereco.longitude})`
                  : ''}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="inline text-zinc-400">Operações: </dt>
              <dd className="inline">
                {d.operacoes.length
                  ? d.operacoes
                      .map((op) => `${op.nome}${op.canais.length ? ` (${op.canais.map((c) => `${c.nome}${c.habilitado ? '' : ' desabilitado'}`).join(', ')})` : ''}`)
                      .join(' · ')
                  : '—'}
              </dd>
            </div>
          </dl>
          <div className="space-y-1 border-t border-zinc-200 pt-2">
            <b className="text-zinc-900">Disponibilidade agora</b>
            {detalhe.status.length === 0 ? <div>O iFood não informou operações para esta loja.</div> : null}
            {detalhe.status.map((op) => (
              <div key={`${op.operacao}-${op.canal}`}>
                <b>{op.operacao}</b>
                {op.canal ? ` · ${op.canal}` : ''}: {op.disponivel ? 'disponível' : 'indisponível'} ({ROTULO_ESTADO[op.estado] ?? op.estado})
                {op.titulo || op.descricao ? ` — ${[op.titulo, op.descricao].filter(Boolean).join(' · ')}` : ''}
                {op.pendencias.length ? (
                  <ul className="list-disc pl-5">
                    {op.pendencias.map((p) => (
                      <li key={p.codigo}>{[p.titulo ?? p.codigo, p.descricao].filter(Boolean).join(' — ')}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
            <div className="text-zinc-400">Consultado em {dataHora(detalhe.consultadoEm)}</div>
          </div>
        </div>
      ) : null}

      <Aviso mensagem={mensagem} />
    </Secao>
  );
}

// ------------------------------------------------------------ Cenário 2

function PausasLoja() {
  const { confirmar } = useAvisosPainel();
  const [pausas, setPausas] = useState<PausaIfood[] | null>(null);
  const [agoraIfood, setAgoraIfood] = useState('');
  // O GET de pausas do iFood demora alguns minutos para refletir criação e
  // remoção. Guardamos o que o próprio iFood já confirmou (201/204) para a
  // lista não "desfazer" a ação enquanto o cache dele não atualiza.
  const [criadas, setCriadas] = useState<PausaIfood[]>([]);
  const [removidas, setRemovidas] = useState<string[]>([]);
  const [descricao, setDescricao] = useState('');
  const [inicio, setInicio] = useState(() => paraInputBrasilia(new Date()));
  const [fim, setFim] = useState(() => paraInputBrasilia(new Date(Date.now() + 30 * 60000)));
  const [carregando, setCarregando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem>(null);

  const listar = useCallback(async (avisar = true) => {
    setCarregando('lista');
    const resultado = await listarPausasIfoodAction();
    if (resultado.success) {
      setPausas(resultado.pausas);
      setAgoraIfood(resultado.agora);
      if (avisar) {
        setMensagem(null);
      }
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error });
    }
    setCarregando(null);
  }, []);

  useEffect(() => {
    const primeira = setTimeout(() => void listar(), 0);
    return () => clearTimeout(primeira);
  }, [listar]);

  const cadastrar = async () => {
    setCarregando('criar');
    setMensagem(null);
    const resultado = await criarPausaIfoodAction(descricao, inicio, fim);
    if (resultado.success) {
      setMensagem({ tipo: 'success', texto: 'Pausa cadastrada no iFood.' });
      setDescricao('');
      setCriadas((atual) => [...atual, resultado.pausa]);
      await listar(false);
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error });
    }
    setCarregando(null);
  };

  const remover = async (pausa: PausaIfood) => {
    const confirmado = await confirmar({
      titulo: 'Remover a pausa?',
      mensagem: `"${pausa.descricao}" sai do iFood e a loja volta a receber pedidos.`,
      rotuloConfirmar: 'Remover',
      perigo: true,
    });
    if (!confirmado) {
      return;
    }
    setCarregando(pausa.id);
    setMensagem(null);
    const resultado = await removerPausaIfoodAction(pausa.id);
    if (resultado.success) {
      setMensagem({ tipo: 'success', texto: 'Pausa removida no iFood.' });
      setRemovidas((atual) => [...atual, pausa.id]);
      setCriadas((atual) => atual.filter((item) => item.id !== pausa.id));
      await listar(false);
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error });
    }
    setCarregando(null);
  };

  const visiveis = pausas
    ? [...pausas, ...criadas.filter((criada) => !pausas.some((pausa) => pausa.id === criada.id))]
        .filter((pausa) => !removidas.includes(pausa.id) && pausa.fim > agoraIfood)
        .sort((a, b) => a.inicio.localeCompare(b.inicio))
    : null;

  return (
    <Secao
      titulo="Pausas da loja"
      descricao="Enquanto a pausa estiver ativa, a loja não recebe pedidos no iFood. Horários de Brasília."
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <label className="text-xs text-zinc-600">
          Motivo
          <input
            type="text"
            value={descricao}
            maxLength={100}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: falta de entregadores"
            className={`mt-1 block w-full ${CLASSE_INPUT}`}
          />
        </label>
        <label className="text-xs text-zinc-600">
          Início
          <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className={`mt-1 block ${CLASSE_INPUT}`} />
        </label>
        <label className="text-xs text-zinc-600">
          Fim
          <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className={`mt-1 block ${CLASSE_INPUT}`} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={cadastrar} disabled={!!carregando || !descricao.trim()} className={CLASSE_BOTAO}>
          {carregando === 'criar' ? 'Cadastrando...' : 'Cadastrar pausa'}
        </button>
        <button type="button" onClick={() => listar()} disabled={!!carregando} className={CLASSE_BOTAO_SECUNDARIO}>
          {carregando === 'lista' ? 'Consultando...' : 'Listar pausas ativas'}
        </button>
      </div>

      {visiveis ? (
        visiveis.length === 0 ? (
          <div className="text-xs text-zinc-500">Nenhuma pausa ativa ou agendada no iFood.</div>
        ) : (
          <ul className="divide-y divide-zinc-100 text-xs text-zinc-700">
            {visiveis.map((pausa) => {
              const ativa = pausa.inicio <= agoraIfood && pausa.fim > agoraIfood;
              return (
                <li key={pausa.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <b className="text-zinc-900">{pausa.descricao || 'Pausa'}</b>{' '}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        ativa ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {ativa ? 'ativa' : 'agendada'}
                    </span>
                    <div className="text-zinc-500">
                      {dataHoraPausa(pausa.inicio)} até {dataHoraPausa(pausa.fim)}
                    </div>
                    <div className="font-mono text-[10px] text-zinc-400">{pausa.id}</div>
                  </div>
                  <button type="button" onClick={() => remover(pausa)} disabled={!!carregando} className={CLASSE_BOTAO_SECUNDARIO}>
                    {carregando === pausa.id ? 'Removendo...' : 'Remover'}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      <Aviso mensagem={mensagem} />
    </Secao>
  );
}

// ------------------------------------------------------------ Cenário 3

function HorarioFuncionamento() {
  const [edicao, setEdicao] = useState(() => turnosParaEdicao([]));
  const [noIfood, setNoIfood] = useState<{ turnos: TurnoIfood[]; consultadoEm: string } | null>(null);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem>(null);

  const consultar = useCallback(async (preencherEdicao: boolean) => {
    setCarregando('consultar');
    const resultado = await consultarHorariosIfoodAction();
    if (resultado.success) {
      setNoIfood({ turnos: resultado.turnos, consultadoEm: resultado.consultadoEm });
      if (preencherEdicao) {
        setEdicao(turnosParaEdicao(resultado.turnos));
      }
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error });
    }
    setCarregando(null);
  }, []);

  useEffect(() => {
    const primeira = setTimeout(() => void consultar(true), 0);
    return () => clearTimeout(primeira);
  }, [consultar]);

  const alterarTurno = (dia: DiaSemanaIfood, indice: number, campo: keyof TurnoEditavel, valor: string) => {
    setEdicao((atual) => ({
      ...atual,
      [dia]: atual[dia].map((turno, i) => (i === indice ? { ...turno, [campo]: valor } : turno)),
    }));
  };

  const adicionarTurno = (dia: DiaSemanaIfood) => {
    setEdicao((atual) => ({ ...atual, [dia]: [...atual[dia], { inicio: '', fim: '' }] }));
  };

  const removerTurno = (dia: DiaSemanaIfood, indice: number) => {
    setEdicao((atual) => ({ ...atual, [dia]: atual[dia].filter((_, i) => i !== indice) }));
  };

  const salvar = async () => {
    const turnos = DIAS.flatMap((dia) => edicao[dia.id].map((turno) => ({ dia: dia.id, ...turno })));
    if (turnos.some((turno) => !turno.inicio || !turno.fim)) {
      setMensagem({ tipo: 'error', texto: 'Preencha início e fim de todos os turnos (ou remova os vazios).' });
      return;
    }
    setCarregando('salvar');
    setMensagem(null);
    const resultado = await salvarHorariosIfoodAction(turnos);
    if (resultado.success) {
      setEdicao(turnosParaEdicao(resultado.turnos));
      setMensagem({
        tipo: 'success',
        texto: 'Horário de funcionamento salvo no iFood. A consulta do iFood pode levar alguns minutos para mostrar a mudança.',
      });
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error });
    }
    setCarregando(null);
  };

  return (
    <Secao
      titulo="Horário de funcionamento"
      descricao="O iFood substitui a semana inteira ao salvar: dia sem turno fica fechado."
    >
      <div className="space-y-2">
        {DIAS.map((dia) => (
          <div key={dia.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="w-16 font-semibold text-zinc-900">{dia.rotulo}</span>
            {edicao[dia.id].length === 0 ? <span className="text-zinc-400">Fechado</span> : null}
            {edicao[dia.id].map((turno, indice) => (
              <span key={indice} className="flex items-center gap-1 rounded-xl border border-zinc-200 px-2 py-1">
                <input
                  type="time"
                  value={turno.inicio}
                  onChange={(e) => alterarTurno(dia.id, indice, 'inicio', e.target.value)}
                  aria-label={`${dia.rotulo}: início do turno ${indice + 1}`}
                  className="rounded border border-zinc-200 px-1 py-0.5 text-xs"
                />
                às
                <input
                  type="time"
                  value={turno.fim}
                  onChange={(e) => alterarTurno(dia.id, indice, 'fim', e.target.value)}
                  aria-label={`${dia.rotulo}: fim do turno ${indice + 1}`}
                  className="rounded border border-zinc-200 px-1 py-0.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => removerTurno(dia.id, indice)}
                  aria-label={`Remover turno ${indice + 1} de ${dia.rotulo}`}
                  className="px-1 font-bold text-zinc-400 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => adicionarTurno(dia.id)}
              className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900"
            >
              + turno
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={salvar} disabled={!!carregando} className={CLASSE_BOTAO}>
          {carregando === 'salvar' ? 'Salvando...' : 'Salvar horários no iFood'}
        </button>
        <button type="button" onClick={() => consultar(false)} disabled={!!carregando} className={CLASSE_BOTAO_SECUNDARIO}>
          {carregando === 'consultar' ? 'Consultando...' : 'Consultar horários configurados'}
        </button>
      </div>

      {noIfood ? (
        <div className="space-y-1 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700">
          <b className="text-zinc-900">Horários configurados no iFood</b>
          {DIAS.map((dia) => {
            const doDia = noIfood.turnos.filter((turno) => turno.dia === dia.id);
            return (
              <div key={dia.id}>
                <span className="inline-block w-16 font-semibold">{dia.rotulo}</span>
                {doDia.length ? doDia.map((turno) => `${turno.inicio} às ${fimDoTurno(turno)}`).join(', ') : 'Fechado'}
              </div>
            );
          })}
          <div className="text-zinc-400">Consultado em {dataHora(noIfood.consultadoEm)}</div>
        </div>
      ) : null}

      <Aviso mensagem={mensagem} />
    </Secao>
  );
}

/** Gestão da loja no iFood (módulo Merchant): lojas, pausas e horários. */
export function GestaoLojaIfood() {
  return (
    <div className="space-y-3">
      <LojasVinculadas />
      <PausasLoja />
      <HorarioFuncionamento />
    </div>
  );
}
