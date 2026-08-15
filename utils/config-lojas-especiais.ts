// Configurações pontuais por loja (slug) que ainda não têm um campo dedicado
// no banco de dados. Usado tanto no checkout (server e client) quanto nas
// vitrines customizadas em components/ecommerce/lojas.
//
// Quando migrarmos essas configurações para colunas em `restaurantes`,
// este arquivo pode ser removido.

export interface ConfigLojaEspecial {
  /** Valor fixo (em reais) somado ao total do pedido em toda compra com entrega. */
  taxaEntregaFixa: number;
  /** Se true, a opção "Retirada" fica oculta no checkout desta loja. */
  ocultarRetirada: boolean;
  /**
   * Limite máximo de unidades de "comida" (itens que não são bebida, ver
   * `ehBebida`) somadas em todo o pedido. `undefined`/`0` = sem limite.
   */
  limiteUnidadesComida?: number;
}

const CONFIG_PADRAO: ConfigLojaEspecial = {
  taxaEntregaFixa: 0,
  ocultarRetirada: false,
};

const CONFIGS_LOJAS_ESPECIAIS: Record<string, ConfigLojaEspecial> = {
  godog: {
    taxaEntregaFixa: 5,
    ocultarRetirada: true,
    limiteUnidadesComida: 3,
  },
};

export function obterConfigLojaEspecial(slug: string | null | undefined): ConfigLojaEspecial {
  const chave = (slug ?? '').trim();
  return CONFIGS_LOJAS_ESPECIAIS[chave] ?? CONFIG_PADRAO;
}

/**
 * Heurística por nome do produto para separar bebidas de "comida" quando a
 * loja ainda não tem uma categoria dedicada no cardápio. Usado pela vitrine
 * da GoDog e pela validação de limite de unidades no checkout.
 */
export function ehBebida(nome: string) {
  return /coca|guaran[aá]|suco|[aá]gua|refrigerante|milk\s*-?shake|shake|sprite|limonada|ch[aá]/i.test(nome);
}
