export interface HorarioFuncionamentoDia {
  dia: number;
  ativo: boolean;
  abertura: string;
  fechamento: string;
}

export const NOMES_DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

export const HORARIOS_PADRAO_FORM: HorarioFuncionamentoDia[] = Array.from({ length: 7 }, (_, dia) => ({
  dia,
  ativo: true,
  abertura: '08:00',
  fechamento: '22:00',
}));

const FUSO_HORARIO_LOJA = 'America/Sao_Paulo';

function converterMinutos(horaMinuto: string): number {
  const [horas, minutos] = horaMinuto.split(':').map(Number);
  return horas * 60 + minutos;
}

/** Dia da semana atual no fuso horário da loja (0=Domingo .. 6=Sábado). */
export function obterDiaSemanaAtualBrasil(agora = new Date()): number {
  return obterDiaEHoraAtualBrasilia(agora).dia;
}

function obterDiaEHoraAtualBrasilia(agora: Date): { dia: number; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO_HORARIO_LOJA,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(agora);

  const mapaDias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const diaAbreviado = partes.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? '0');
  const minuto = Number(partes.find((p) => p.type === 'minute')?.value ?? '0');

  return { dia: mapaDias[diaAbreviado] ?? 0, minutos: hora * 60 + minuto };
}

function dentroDaJanela(minutosAgora: number, abertura: string, fechamento: string): boolean {
  const inicio = converterMinutos(abertura);
  const fim = converterMinutos(fechamento);

  if (fim <= inicio) {
    return minutosAgora >= inicio || minutosAgora < fim;
  }

  return minutosAgora >= inicio && minutosAgora < fim;
}

export function estaLojaAberta(horarios: HorarioFuncionamentoDia[] | null | undefined, agora = new Date()): boolean {
  if (!horarios || horarios.length === 0) {
    return true;
  }

  const { dia, minutos } = obterDiaEHoraAtualBrasilia(agora);
  const diaAnterior = (dia + 6) % 7;

  const horarioHoje = horarios.find((h) => h.dia === dia);
  if (horarioHoje?.ativo && dentroDaJanela(minutos, horarioHoje.abertura, horarioHoje.fechamento)) {
    return true;
  }

  const horarioOntem = horarios.find((h) => h.dia === diaAnterior);
  if (horarioOntem?.ativo) {
    const inicioOntem = converterMinutos(horarioOntem.abertura);
    const fimOntem = converterMinutos(horarioOntem.fechamento);
    if (fimOntem <= inicioOntem && minutos < fimOntem) {
      return true;
    }
  }

  return false;
}
