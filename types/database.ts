
export interface AdicionalSelecionado {
  id: string;
  nome: string;
  preco: number;
}

export interface Restaurante {
  id: string;
  nome: string;
  tipo: string;
  slug: string;
  endereco: string | null;
  logo_url: string | null;
  status_assinatura: string;
  meta_pixel_id: string | null;
  stripe_account_id: string | null;
  gateway_customer_id: string | null;
  email_corporativo: string | null;
  meta_access_token: string | null;
  meta_ad_account_id: string | null;
  created_at: string;
}

export interface RestauranteIntegracaoPagamento {
  id: string;
  restaurante_id: string;
  provedor: string;
  provider_user_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  connection_status: 'pendente' | 'conectado' | 'desconectado';
  account_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestauranteIntegracaoWhatsappBusiness {
  id: string;
  restaurante_id: string;
  connection_status: 'pendente' | 'conectado' | 'desconectado';
  access_token: string | null;
  token_expires_at: string | null;
  meta_user_id: string | null;
  meta_user_email: string | null;
  waba_id: string | null;
  waba_name: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  template_name: string | null;
  template_language_code: string | null;
  template_status: string | null;
  api_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface Insumo {
  id: string;
  restaurante_id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  estoque_atual: number;
  estoque_minimo: number;
  created_at: string;
}

export interface ItemCardapio {
  id: string;
  restaurante_id: string;
  nome: string;
  descricao: string;
  preco_venda: number;
  disponivel: boolean;
  imagem_url: string;
  created_at: string;
  /** Categoria estrutural do item (ex.: "Pratos", "Acompanhamentos", "Bebidas", "Sobremesas"). Texto livre, opcional. */
  categoria?: string | null;
  /** Dia da semana em que o item fica disponível para pedido (0=Domingo .. 6=Sábado). null = disponível todos os dias. */
  dia_semana?: number | null;
  complementos_produto?: ComplementoProduto[];

  adicionais_selecionados?: AdicionalSelecionado[];
}

export interface ComposicaoProduto {
  id: string;
  item_cardapio_id: string;
  insumo_id: string;
  quantidade_necessaria: number;
  created_at: string;
}

export interface ComplementoProduto {
  id: string;
  item_cardapio_id: string;
  nome: string;
  preco_adicional: number;
  disponivel: boolean;
  created_at: string;
  grupo?: string | null;
}

export type FormaPagamento = 'PIX' | 'DINHEIRO' | 'CARTAO';
