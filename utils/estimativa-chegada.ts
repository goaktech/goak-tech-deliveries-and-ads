
export interface ConfiguracaoTempoPreparo {
  baseMinutos: number;
  incrementoPorPedidoMinutos: number;
  tetoMinutos: number;
}

export function calcularTempoPreparoEstimado(
  config: ConfiguracaoTempoPreparo,
  pedidosNaFila: number
): number {
  const bruto = config.baseMinutos + config.incrementoPorPedidoMinutos * Math.max(0, pedidosNaFila);
  return Math.min(Math.max(0, bruto), config.tetoMinutos);
}

function calcularMinutosDecorridos(dataReferenciaIso: string): number {
  const referencia = new Date(dataReferenciaIso).getTime();
  if (Number.isNaN(referencia)) {
    return 0;
  }
  return (Date.now() - referencia) / 60000;
}

export function calcularMinutosRestantes(totalMinutos: number, referenciaIso: string): number {
  const decorridos = calcularMinutosDecorridos(referenciaIso);
  return Math.max(0, Math.round(totalMinutos - decorridos));
}
