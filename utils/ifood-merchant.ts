// utils/ifood-merchant.ts
// Gestão da loja pela Merchant API do iFood (módulo Merchant da homologação):
// lojas vinculadas ao token, detalhes, pausas (interrupções) e horário de
// funcionamento. Tudo passa pelo token da loja conectada ao goak.

import { requisicaoIfood } from '@/utils/ifood';

const TAMANHO_PAGINA_LOJAS = 100;
const MAX_PAGINAS_LOJAS = 20;

export const DIAS_SEMANA_IFOOD = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
export type DiaSemanaIfood = (typeof DIAS_SEMANA_IFOOD)[number];

export interface LojaVinculadaIfood {
  id: string;
  nome: string | null;
  razaoSocial: string | null;
}

export interface DetalhesLojaIfood {
  id: string;
  nome: string | null;
  razaoSocial: string | null;
  descricao: string | null;
  ticketMedio: number | null;
  exclusiva: boolean | null;
  tipo: string | null;
  status: string | null;
  criadaEm: string | null;
  endereco: {
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
    pais: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  operacoes: Array<{ nome: string; canais: Array<{ nome: string; habilitado: boolean }> }>;
}

/** Início e fim em hora local de Brasília, sem fuso ("AAAA-MM-DDTHH:MM:SS"). */
export interface PausaIfood {
  id: string;
  descricao: string;
  inicio: string;
  fim: string;
}

/** Turno de funcionamento: início "HH:MM" e duração em minutos. */
export interface TurnoIfood {
  dia: DiaSemanaIfood;
  inicio: string;
  duracaoMinutos: number;
}

function erroIfood(status: number, texto: string, padrao: string) {
  let detalhe = '';
  try {
    const corpo = JSON.parse(texto) as { message?: string; error?: { message?: string } };
    detalhe = corpo.error?.message ?? corpo.message ?? '';
  } catch {
    detalhe = '';
  }
  if (status === 401) {
    return new Error('O token do iFood expirou ou foi revogado. Conecte a loja novamente.');
  }
  if (status === 403) {
    return new Error('O iFood negou acesso a esta loja (403). Confira se ela autorizou o goak.');
  }
  return new Error(detalhe ? `${padrao} iFood: ${detalhe} (HTTP ${status})` : `${padrao} (HTTP ${status})`);
}

// ------------------------------------------------------------ lojas

/** Todas as lojas que o token pode operar (GET /merchants, paginado). */
export async function listarLojasVinculadasIfood(accessToken: string): Promise<LojaVinculadaIfood[]> {
  const lojas: LojaVinculadaIfood[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS_LOJAS; pagina++) {
    const resposta = await requisicaoIfood<Array<{ id: string; name?: string; corporateName?: string }>>(
      '/merchant/v1.0/merchants',
      { accessToken, query: { page: pagina, size: TAMANHO_PAGINA_LOJAS } }
    );
    if (resposta.status !== 200 || !Array.isArray(resposta.body)) {
      throw erroIfood(resposta.status, resposta.texto, 'Não foi possível listar as lojas vinculadas.');
    }
    lojas.push(
      ...resposta.body.map((loja) => ({ id: loja.id, nome: loja.name ?? null, razaoSocial: loja.corporateName ?? null }))
    );
    if (resposta.body.length < TAMANHO_PAGINA_LOJAS) {
      break;
    }
  }
  return lojas;
}

interface MerchantBruto {
  id: string;
  name?: string;
  corporateName?: string;
  description?: string;
  averageTicket?: number;
  exclusive?: boolean;
  type?: string;
  status?: string;
  createdAt?: string;
  address?: {
    country?: string;
    state?: string;
    city?: string;
    postalCode?: string;
    district?: string;
    street?: string;
    number?: string;
    latitude?: number;
    longitude?: number;
  };
  operations?: OperacaoBruta[] | OperacaoBruta;
}

interface OperacaoBruta {
  name?: string;
  salesChannels?: CanalBruto[];
  salesChannel?: CanalBruto | CanalBruto[];
}

interface CanalBruto {
  name?: string;
  enabled?: boolean | string;
}

function listaDeCanais(canal: CanalBruto | CanalBruto[] | undefined) {
  const canais = Array.isArray(canal) ? canal : canal ? [canal] : [];
  return canais.map((item) => ({
    nome: item.name ?? '',
    habilitado: item.enabled === true || item.enabled === 'true',
  }));
}

/** Detalhes completos da loja (GET /merchants/{id}). */
export async function buscarDetalhesLojaIfood(accessToken: string, merchantId: string): Promise<DetalhesLojaIfood> {
  const resposta = await requisicaoIfood<MerchantBruto>(`/merchant/v1.0/merchants/${merchantId}`, { accessToken });
  if (resposta.status !== 200 || !resposta.body) {
    throw erroIfood(resposta.status, resposta.texto, 'Não foi possível buscar os detalhes da loja.');
  }

  const loja = resposta.body;
  const a = loja.address ?? {};
  const operacoesBrutas = Array.isArray(loja.operations) ? loja.operations : loja.operations ? [loja.operations] : [];

  return {
    id: loja.id,
    nome: loja.name ?? null,
    razaoSocial: loja.corporateName ?? null,
    descricao: loja.description ?? null,
    ticketMedio: typeof loja.averageTicket === 'number' ? loja.averageTicket : null,
    exclusiva: typeof loja.exclusive === 'boolean' ? loja.exclusive : null,
    tipo: loja.type ?? null,
    status: loja.status ?? null,
    criadaEm: loja.createdAt ?? null,
    endereco: {
      logradouro: a.street ?? null,
      numero: a.number ?? null,
      bairro: a.district ?? null,
      cidade: a.city ?? null,
      estado: a.state ?? null,
      cep: a.postalCode ?? null,
      pais: a.country ?? null,
      latitude: typeof a.latitude === 'number' ? a.latitude : null,
      longitude: typeof a.longitude === 'number' ? a.longitude : null,
    },
    operacoes: operacoesBrutas.map((operacao) => ({
      nome: operacao.name ?? '',
      canais: listaDeCanais(operacao.salesChannels ?? operacao.salesChannel),
    })),
  };
}

// ------------------------------------------------------------ pausas

interface InterrupcaoBruta {
  id?: string;
  description?: string;
  start?: string;
  end?: string;
}

/**
 * Pausas usam hora local de Brasília sem fuso ("2026-10-14T13:44:00"): é assim
 * que o iFood devolve e é assim que ele aplica. Se mandar com fuso, ele
 * converte para UTC e passa a tratar o resultado como hora local (a pausa
 * fica 3 h deslocada) — conferido na loja de testes em 14-10-2026.
 */
export const FUSO_PAUSAS_IFOOD = 'America/Sao_Paulo';

/** "AAAA-MM-DDTHH:MM:SS" do instante informado no horário de Brasília. */
export function horaLocalPausaIfood(data = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO_PAUSAS_IFOOD,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(data)
      .map((parte) => [parte.type, parte.value])
  );
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}`;
}

function semFuso(data: string | undefined) {
  return (data ?? '').replace(/(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/, '');
}

function paraPausa(item: InterrupcaoBruta): PausaIfood {
  return { id: item.id ?? '', descricao: item.description ?? '', inicio: semFuso(item.start), fim: semFuso(item.end) };
}

/** Pausas atuais e futuras da loja (GET /interruptions). */
export async function listarPausasIfood(accessToken: string, merchantId: string): Promise<PausaIfood[]> {
  const resposta = await requisicaoIfood<InterrupcaoBruta[]>(`/merchant/v1.0/merchants/${merchantId}/interruptions`, {
    accessToken,
  });
  if (resposta.status !== 200 || !Array.isArray(resposta.body)) {
    throw erroIfood(resposta.status, resposta.texto, 'Não foi possível listar as pausas da loja.');
  }
  return resposta.body.map(paraPausa).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Cria uma pausa (POST /interruptions). Início e fim em hora de Brasília, sem fuso. */
export async function criarPausaIfood(
  accessToken: string,
  merchantId: string,
  pausa: { descricao: string; inicio: string; fim: string }
): Promise<PausaIfood> {
  const resposta = await requisicaoIfood<InterrupcaoBruta>(`/merchant/v1.0/merchants/${merchantId}/interruptions`, {
    method: 'POST',
    accessToken,
    json: { description: pausa.descricao, start: pausa.inicio, end: pausa.fim },
  });
  if (resposta.status !== 201 && resposta.status !== 200) {
    throw erroIfood(resposta.status, resposta.texto, 'Não foi possível criar a pausa.');
  }
  return paraPausa(resposta.body ?? { description: pausa.descricao, start: pausa.inicio, end: pausa.fim });
}

/** Remove uma pausa atual ou futura (DELETE /interruptions/{id}). */
export async function removerPausaIfood(accessToken: string, merchantId: string, pausaId: string) {
  const resposta = await requisicaoIfood<unknown>(
    `/merchant/v1.0/merchants/${merchantId}/interruptions/${encodeURIComponent(pausaId)}`,
    { method: 'DELETE', accessToken }
  );
  if (resposta.status === 409) {
    throw new Error('O iFood ainda não deixa remover esta pausa porque ela acabou de ser criada. Tente de novo em alguns segundos.');
  }
  if (resposta.status !== 204 && resposta.status !== 200) {
    throw erroIfood(resposta.status, resposta.texto, 'Não foi possível remover a pausa.');
  }
}

// ------------------------------------------------------------ horário de funcionamento

interface HorariosBrutos {
  shifts?: Array<{ dayOfWeek?: string; start?: string; duration?: number }>;
}

function diaValido(dia: string | undefined): dia is DiaSemanaIfood {
  return !!dia && (DIAS_SEMANA_IFOOD as readonly string[]).includes(dia);
}

/** Horário configurado no iFood (GET /opening-hours), ordenado por dia e início. */
export async function obterHorariosIfood(accessToken: string, merchantId: string): Promise<TurnoIfood[]> {
  const resposta = await requisicaoIfood<HorariosBrutos>(`/merchant/v1.0/merchants/${merchantId}/opening-hours`, {
    accessToken,
  });
  if (resposta.status !== 200) {
    throw erroIfood(resposta.status, resposta.texto, 'Não foi possível consultar o horário de funcionamento.');
  }
  return (resposta.body?.shifts ?? [])
    .filter((turno) => diaValido(turno.dayOfWeek) && typeof turno.duration === 'number' && !!turno.start)
    .map((turno) => ({
      dia: turno.dayOfWeek as DiaSemanaIfood,
      inicio: (turno.start as string).slice(0, 5),
      duracaoMinutos: turno.duration as number,
    }))
    .sort((a, b) => DIAS_SEMANA_IFOOD.indexOf(a.dia) - DIAS_SEMANA_IFOOD.indexOf(b.dia) || a.inicio.localeCompare(b.inicio));
}

/**
 * Grava o horário da semana inteira (PUT /opening-hours). O iFood substitui
 * todos os turnos: dia que não vier na lista fica fechado.
 */
export async function salvarHorariosIfood(accessToken: string, merchantId: string, turnos: TurnoIfood[]) {
  const resposta = await requisicaoIfood<unknown>(`/merchant/v1.0/merchants/${merchantId}/opening-hours`, {
    method: 'PUT',
    accessToken,
    json: {
      storeId: merchantId,
      shifts: turnos.map((turno) => ({
        dayOfWeek: turno.dia,
        start: `${turno.inicio}:00`,
        duration: turno.duracaoMinutos,
      })),
    },
  });
  if (resposta.status !== 201 && resposta.status !== 200 && resposta.status !== 204) {
    throw erroIfood(resposta.status, resposta.texto, 'Não foi possível salvar o horário de funcionamento.');
  }
}
