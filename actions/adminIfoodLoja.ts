'use server';

import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import {
  type StatusOperacaoIfood,
  consultarStatusOperacaoIfood,
  obterAccessTokenIfood,
  obterIntegracaoIfoodPorRestauranteId,
} from '@/utils/ifood';
import {
  type DetalhesLojaIfood,
  type LojaVinculadaIfood,
  type PausaIfood,
  type TurnoIfood,
  DIAS_SEMANA_IFOOD,
  buscarDetalhesLojaIfood,
  criarPausaIfood,
  horaLocalPausaIfood,
  listarLojasVinculadasIfood,
  listarPausasIfood,
  obterHorariosIfood,
  removerPausaIfood,
  salvarHorariosIfood,
} from '@/utils/ifood-merchant';

type Resultado<T> = ({ success: true } & T) | { success: false; error: string };

const MINUTOS_DIA = 24 * 60;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DESCRICAO_PAUSA = 100;
const DATA_HORA_REGEX = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function mensagemDeErro(erro: unknown, padrao: string) {
  return erro instanceof Error ? erro.message : padrao;
}

async function lojaConectada() {
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const integracao = await obterIntegracaoIfoodPorRestauranteId(restauranteId);
  if (!integracao?.merchant_id || integracao.connection_status !== 'conectado') {
    throw new Error('Conecte a loja do iFood primeiro.');
  }
  return { accessToken: await obterAccessTokenIfood(restauranteId), merchantId: integracao.merchant_id };
}

export async function listarLojasVinculadasAction(): Promise<Resultado<{ lojas: LojaVinculadaIfood[]; conectadaId: string }>> {
  try {
    const { accessToken, merchantId } = await lojaConectada();
    return { success: true, lojas: await listarLojasVinculadasIfood(accessToken), conectadaId: merchantId };
  } catch (erro) {
    console.error('Erro ao listar lojas vinculadas no iFood:', erro);
    return { success: false, error: mensagemDeErro(erro, 'Falha ao listar as lojas vinculadas.') };
  }
}

export async function detalharLojaIfoodAction(
  lojaId: string
): Promise<Resultado<{ detalhes: DetalhesLojaIfood; status: StatusOperacaoIfood[]; consultadoEm: string }>> {
  try {
    const { accessToken } = await lojaConectada();
    const vinculadas = await listarLojasVinculadasIfood(accessToken);
    if (!vinculadas.some((loja) => loja.id === lojaId)) {
      return { success: false, error: 'Esta loja não está vinculada ao goak.' };
    }
    const [detalhes, status] = await Promise.all([
      buscarDetalhesLojaIfood(accessToken, lojaId),
      consultarStatusOperacaoIfood(accessToken, lojaId),
    ]);
    return { success: true, detalhes, status, consultadoEm: new Date().toISOString() };
  } catch (erro) {
    console.error('Erro ao detalhar loja iFood:', erro);
    return { success: false, error: mensagemDeErro(erro, 'Falha ao buscar os detalhes da loja.') };
  }
}

export async function listarPausasIfoodAction(): Promise<Resultado<{ pausas: PausaIfood[]; agora: string }>> {
  try {
    const { accessToken, merchantId } = await lojaConectada();
    return { success: true, pausas: await listarPausasIfood(accessToken, merchantId), agora: horaLocalPausaIfood() };
  } catch (erro) {
    console.error('Erro ao listar pausas no iFood:', erro);
    return { success: false, error: mensagemDeErro(erro, 'Falha ao listar as pausas.') };
  }
}

export async function criarPausaIfoodAction(
  descricao: string,
  inicio: string,
  fim: string
): Promise<Resultado<{ pausa: PausaIfood }>> {
  try {
    const texto = descricao.trim();
    if (!texto) {
      return { success: false, error: 'Informe o motivo da pausa.' };
    }
    if (texto.length > MAX_DESCRICAO_PAUSA) {
      return { success: false, error: `O motivo da pausa pode ter até ${MAX_DESCRICAO_PAUSA} caracteres.` };
    }
    if (!DATA_HORA_REGEX.test(inicio) || !DATA_HORA_REGEX.test(fim)) {
      return { success: false, error: 'Informe data e hora de início e de fim.' };
    }
    const inicioLocal = `${inicio.slice(0, 16)}:00`;
    const fimLocal = `${fim.slice(0, 16)}:00`;
    if (fimLocal <= inicioLocal) {
      return { success: false, error: 'O fim da pausa precisa ser depois do início.' };
    }
    if (fimLocal <= horaLocalPausaIfood()) {
      return { success: false, error: 'O fim da pausa já passou.' };
    }

    const { accessToken, merchantId } = await lojaConectada();
    const pausa = await criarPausaIfood(accessToken, merchantId, { descricao: texto, inicio: inicioLocal, fim: fimLocal });
    return { success: true, pausa };
  } catch (erro) {
    console.error('Erro ao criar pausa no iFood:', erro);
    return { success: false, error: mensagemDeErro(erro, 'Falha ao criar a pausa.') };
  }
}

export async function removerPausaIfoodAction(pausaId: string): Promise<Resultado<object>> {
  try {
    if (!pausaId) {
      return { success: false, error: 'Pausa inválida.' };
    }
    const { accessToken, merchantId } = await lojaConectada();
    await removerPausaIfood(accessToken, merchantId, pausaId);
    return { success: true };
  } catch (erro) {
    console.error('Erro ao remover pausa no iFood:', erro);
    return { success: false, error: mensagemDeErro(erro, 'Falha ao remover a pausa.') };
  }
}

export async function consultarHorariosIfoodAction(): Promise<Resultado<{ turnos: TurnoIfood[]; consultadoEm: string }>> {
  try {
    const { accessToken, merchantId } = await lojaConectada();
    return { success: true, turnos: await obterHorariosIfood(accessToken, merchantId), consultadoEm: new Date().toISOString() };
  } catch (erro) {
    console.error('Erro ao consultar horários no iFood:', erro);
    return { success: false, error: mensagemDeErro(erro, 'Falha ao consultar o horário de funcionamento.') };
  }
}

function paraMinutos(hora: string) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function validarTurnos(turnos: Array<{ dia: string; inicio: string; fim: string }>): TurnoIfood[] | string {
  const convertidos: TurnoIfood[] = [];
  for (const turno of turnos) {
    if (!(DIAS_SEMANA_IFOOD as readonly string[]).includes(turno.dia)) {
      return 'Dia da semana inválido.';
    }
    if (!HORA_REGEX.test(turno.inicio) || !(HORA_REGEX.test(turno.fim) || turno.fim === '24:00')) {
      return 'Use horários no formato HH:MM.';
    }
    const inicio = paraMinutos(turno.inicio);
    const fim = turno.fim === '24:00' ? MINUTOS_DIA : paraMinutos(turno.fim);
    if (fim <= inicio) {
      return `Turno ${turno.inicio}–${turno.fim}: o fim precisa ser depois do início.`;
    }
    convertidos.push({ dia: turno.dia as TurnoIfood['dia'], inicio: turno.inicio, duracaoMinutos: fim - inicio });
  }

  for (const dia of DIAS_SEMANA_IFOOD) {
    const doDia = convertidos.filter((turno) => turno.dia === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
    for (let i = 1; i < doDia.length; i++) {
      if (paraMinutos(doDia[i - 1].inicio) + doDia[i - 1].duracaoMinutos > paraMinutos(doDia[i].inicio)) {
        return 'Há turnos sobrepostos no mesmo dia.';
      }
    }
  }
  return convertidos;
}

export async function salvarHorariosIfoodAction(
  turnos: Array<{ dia: string; inicio: string; fim: string }>
): Promise<Resultado<{ turnos: TurnoIfood[] }>> {
  try {
    const validados = validarTurnos(turnos);
    if (typeof validados === 'string') {
      return { success: false, error: validados };
    }
    if (validados.length === 0) {
      return { success: false, error: 'Cadastre pelo menos um turno.' };
    }

    const { accessToken, merchantId } = await lojaConectada();
    await salvarHorariosIfood(accessToken, merchantId, validados);
    return { success: true, turnos: validados };
  } catch (erro) {
    console.error('Erro ao salvar horários no iFood:', erro);
    return { success: false, error: mensagemDeErro(erro, 'Falha ao salvar o horário de funcionamento.') };
  }
}
