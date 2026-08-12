export type StatusPedido = 'PENDENTE' | 'PAGO' | 'PREPARANDO' | 'PRONTO' | 'SAIU_PARA_ENTREGA' | 'ENTREGUE';
export type TipoEntregaPedido = 'ENTREGA' | 'RETIRADA';

export interface DadosClientePedido {
  nome: string;
  telefone: string;
  email?: string;
  tipoEntrega?: TipoEntregaPedido;
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
  return obterEtapasStatusPedido(tipoEntrega).find((etapa) => etapa.chave === status)?.titulo ?? status;
}

export function obterDescricaoStatusPedido(status: StatusPedido, tipoEntrega: TipoEntregaPedido): string {
  return obterEtapasStatusPedido(tipoEntrega).find((etapa) => etapa.chave === status)?.descricao ?? '';
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
