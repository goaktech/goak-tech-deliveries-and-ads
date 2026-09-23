export type StatusPedido = 'PENDENTE' | 'PAGO' | 'PREPARANDO' | 'PRONTO' | 'SAIU_PARA_ENTREGA' | 'ENTREGUE' | 'CANCELADO';

export const STATUS_PEDIDO_TERMINAIS: StatusPedido[] = ['ENTREGUE', 'CANCELADO'];
export type TipoEntregaPedido = 'ENTREGA' | 'RETIRADA';

export interface DadosClientePedido {
  nome: string;
  telefone: string;
  email?: string;
  tipoEntrega?: TipoEntregaPedido;
  observacoes?: string;
  endereco?: {
    rua?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    cep?: string;
  };
}

export interface EtapaStatusPedido {
  chave: StatusPedido;
  titulo: string;
  descricao: string;
}

export function obterTipoEntregaPedido(dadosCliente: Partial<DadosClientePedido> | null | undefined): TipoEntregaPedido {
  if (dadosCliente?.tipoEntrega === 'RETIRADA') {
    return 'RETIRADA';
  }

  return 'ENTREGA';
}

export function obterEtapasStatusPedido(tipoEntrega: TipoEntregaPedido): EtapaStatusPedido[] {
  const etapas: EtapaStatusPedido[] = [
    {
      chave: 'PENDENTE',
      titulo: 'Pedido recebido',
      descricao: 'Recebemos o seu pedido e estamos aguardando a confirmação do pagamento.',
    },
    {
      chave: 'PAGO',
      titulo: 'Pagamento aprovado',
      descricao: 'Seu pagamento foi confirmado com sucesso.',
    },
    {
      chave: 'PREPARANDO',
      titulo: 'Em preparo',
      descricao: 'Sua cozinha já começou a preparar o pedido.',
    },
    {
      chave: 'PRONTO',
      titulo: tipoEntrega === 'RETIRADA' ? 'Pronto para retirada' : 'Pronto para envio',
      descricao:
        tipoEntrega === 'RETIRADA'
          ? 'Seu pedido está finalizado e já pode ser retirado na loja.'
          : 'Seu pedido foi finalizado e está pronto para seguir até você.',
    },
  ];

  if (tipoEntrega === 'ENTREGA') {
    etapas.push({
      chave: 'SAIU_PARA_ENTREGA',
      titulo: 'Saiu para entrega',
      descricao: 'Seu pedido está a caminho com o entregador.',
    });
  }

  etapas.push({
    chave: 'ENTREGUE',
    titulo: tipoEntrega === 'RETIRADA' ? 'Retirado' : 'Entregue',
    descricao:
      tipoEntrega === 'RETIRADA'
        ? 'Seu pedido foi retirado com sucesso.'
        : 'Seu pedido foi entregue com sucesso.',
  });

  return etapas;
}

export function obterIndiceStatusPedido(status: StatusPedido, tipoEntrega: TipoEntregaPedido): number {
  return obterEtapasStatusPedido(tipoEntrega).findIndex((etapa) => etapa.chave === status);
}

export function obterTituloStatusPedido(status: StatusPedido, tipoEntrega: TipoEntregaPedido): string {
  if (status === 'CANCELADO') {
    return 'Pedido cancelado';
  }
  return obterEtapasStatusPedido(tipoEntrega).find((etapa) => etapa.chave === status)?.titulo ?? status;
}

export function obterDescricaoStatusPedido(status: StatusPedido, tipoEntrega: TipoEntregaPedido): string {
  if (status === 'CANCELADO') {
    return 'A loja cancelou este pedido. Se você já pagou, fale com a loja sobre a devolução do valor.';
  }
  return obterEtapasStatusPedido(tipoEntrega).find((etapa) => etapa.chave === status)?.descricao ?? '';
}

export function obterProximoStatusPedido(status: StatusPedido, tipoEntrega: TipoEntregaPedido): StatusPedido | null {
  switch (status) {
    case 'PAGO':
      return 'PREPARANDO';
    case 'PREPARANDO':
      return 'PRONTO';
    case 'PRONTO':
      return tipoEntrega === 'RETIRADA' ? 'ENTREGUE' : 'SAIU_PARA_ENTREGA';
    case 'SAIU_PARA_ENTREGA':
      return 'ENTREGUE';
    default:
      return null;
  }
}

export function ehStatusPedidoTerminal(status: StatusPedido): boolean {
  return STATUS_PEDIDO_TERMINAIS.includes(status);
}

export function formatarNumeroPedido(numeroPedido: number | null | undefined, idReserva: string): string {
  if (typeof numeroPedido === 'number' && Number.isFinite(numeroPedido) && numeroPedido > 0) {
    return String(numeroPedido).padStart(3, '0');
  }
  return idReserva.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function normalizarObservacoesPedido(valor: unknown): string | undefined {
  if (typeof valor !== 'string') {
    return undefined;
  }
  const texto = valor.replace(/\s+/g, ' ').trim().slice(0, 280);
  return texto.length > 0 ? texto : undefined;
}

export function formatarEnderecoPedido(dadosCliente: Partial<DadosClientePedido> | null | undefined): string | null {
  const endereco = dadosCliente?.endereco;
  if (!endereco) {
    return null;
  }

  const partes = [endereco.rua, endereco.numero, endereco.bairro, endereco.cidade, endereco.cep]
    .map((parte) => String(parte ?? '').trim())
    .filter(Boolean);

  return partes.length > 0 ? partes.join(', ') : null;
}

export function montarUrlLocalizacaoEntrega(
  dadosCliente: Partial<DadosClientePedido> | null | undefined,
  latitude?: number | null,
  longitude?: number | null
): string | null {
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
  }

  const enderecoTexto = formatarEnderecoPedido(dadosCliente);
  if (!enderecoTexto) {
    return null;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(enderecoTexto)}&travelmode=driving`;
}

export function montarUrlGeoLocalizacaoEntrega(
  dadosCliente: Partial<DadosClientePedido> | null | undefined,
  latitude?: number | null,
  longitude?: number | null
): string | null {
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    return `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
  }

  const enderecoTexto = formatarEnderecoPedido(dadosCliente);
  if (!enderecoTexto) {
    return null;
  }

  return `geo:0,0?q=${encodeURIComponent(enderecoTexto)}`;
}
