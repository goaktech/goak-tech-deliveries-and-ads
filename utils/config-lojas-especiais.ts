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
}

const CONFIG_PADRAO: ConfigLojaEspecial = {
  taxaEntregaFixa: 0,
  ocultarRetirada: false,
};

const CONFIGS_LOJAS_ESPECIAIS: Record<string, ConfigLojaEspecial> = {
  godog: {
    taxaEntregaFixa: 5,
    ocultarRetirada: true,
  },
};

export function obterConfigLojaEspecial(slug: string | null | undefined): ConfigLojaEspecial {
  const chave = (slug ?? '').trim();
  return CONFIGS_LOJAS_ESPECIAIS[chave] ?? CONFIG_PADRAO;
}
