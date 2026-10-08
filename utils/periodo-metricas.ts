/**
 * Períodos do painel de métricas. Os dias são calculados no fuso de Brasília
 * (UTC-3, sem horário de verão), que é o "dia" que o gestor enxerga.
 */
export type PeriodoMetricas = 'hoje' | '7d' | '30d';

export const PERIODOS_METRICAS: Array<{ valor: PeriodoMetricas; rotulo: string; dias: number }> = [
  { valor: 'hoje', rotulo: 'Hoje', dias: 1 },
  { valor: '7d', rotulo: '7 dias', dias: 7 },
  { valor: '30d', rotulo: '30 dias', dias: 30 },
];

export interface IntervaloMetricas {
  desde: string;
  ate: string;
  dias: string[];
}

export function lerPeriodoMetricas(valor: string | string[] | undefined): PeriodoMetricas {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v === '7d' || v === '30d' ? v : 'hoje';
}

export function descricaoPeriodo(periodo: PeriodoMetricas): string {
  if (periodo === '7d') return 'dos últimos 7 dias';
  if (periodo === '30d') return 'dos últimos 30 dias';
  return 'de hoje';
}

function dataNoFuso(data: Date, offsetHoras: number): string {
  return new Date(data.getTime() + offsetHoras * 3600_000).toISOString().slice(0, 10);
}

/** Lista de dias (AAAA-MM-DD) do período, terminando em `hojeISO`. */
export function calcularIntervalo(periodo: PeriodoMetricas, hojeISO: string): IntervaloMetricas {
  const total = PERIODOS_METRICAS.find((p) => p.valor === periodo)?.dias ?? 1;
  const base = new Date(`${hojeISO}T12:00:00.000Z`);
  const dias: string[] = [];
  for (let i = total - 1; i >= 0; i--) {
    dias.push(new Date(base.getTime() - i * 86_400_000).toISOString().slice(0, 10));
  }
  return { desde: dias[0], ate: dias[dias.length - 1], dias };
}

export function hojeEmBrasilia(): string {
  return dataNoFuso(new Date(), -3);
}

/** Limites em UTC de um intervalo de dias de Brasília (00:00 -03:00 até 23:59:59.999 -03:00). */
export function limitesUtcDoIntervalo(intervalo: IntervaloMetricas): { inicio: string; fim: string } {
  return {
    inicio: new Date(`${intervalo.desde}T00:00:00.000-03:00`).toISOString(),
    fim: new Date(`${intervalo.ate}T23:59:59.999-03:00`).toISOString(),
  };
}
