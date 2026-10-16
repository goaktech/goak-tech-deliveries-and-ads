export interface ZonaEntrega {
  nome: string;
  taxa: number;
  aliases?: string[];
}

export interface ConfigLojaEspecial {
  taxaEntregaFixa: number;
  ocultarRetirada: boolean;
  limiteUnidadesComida?: number;
  zonasEntrega?: ZonaEntrega[];
  cidadeEntrega?: string;
  whatsappAtendimento?: string;
}

const CONFIG_PADRAO: ConfigLojaEspecial = {
  taxaEntregaFixa: 0,
  ocultarRetirada: false,
};

const ZONAS_ENTREGA_PERUCHO: ZonaEntrega[] = [
  { nome: 'Centro', taxa: 6 },
  { nome: 'Residencial Oeste', taxa: 6 },
  { nome: 'Morro Azul', taxa: 6 },
  { nome: 'Setor Tradicional', taxa: 6, aliases: ['S. Tradicional'] },
  { nome: 'São Bartolomeu', taxa: 6, aliases: ['S. Bartolomeu'] },
  { nome: 'Pró-DF', taxa: 6, aliases: ['Pro DF', 'ProDF'] },
  { nome: 'Bonsucesso', taxa: 6 },
  { nome: 'Vila Nova', taxa: 7 },
  { nome: 'São Francisco', taxa: 7 },
  { nome: 'São José', taxa: 7 },
  { nome: 'João Cândido', taxa: 7 },
  { nome: 'Bosque', taxa: 8 },
  { nome: 'Bela Vista', taxa: 8 },
  { nome: 'Bora Manso', taxa: 8 },
  { nome: 'Baía', taxa: 8 },
  { nome: 'Vitória', taxa: 8 },
  { nome: 'Setor Ch. Tradicional (Rua 1 a 19)', taxa: 8 },
  { nome: 'Mangueiral', taxa: 10 },
  { nome: 'Jardim Botânico 3', taxa: 10 },
  { nome: 'Del Rey', taxa: 10 },
  { nome: 'Vilages do Sol', taxa: 10 },
  { nome: 'Vila Green', taxa: 10 },
  { nome: 'Vila do Boa', taxa: 10 },
  { nome: 'Morro da Cruz (até a Chácara 43)', taxa: 10 },
  { nome: 'Crixás', taxa: 10 },
  { nome: 'Ouro Vermelho 2', taxa: 12 },
  { nome: 'Quintas do Itaipu', taxa: 12 },
  { nome: 'Vistas do Itaipu', taxa: 12 },
  { nome: 'M. Braunas', taxa: 12 },
  { nome: 'Quintas dos Ipês', taxa: 12 },
  { nome: 'Avalon', taxa: 12 },
  { nome: 'Atrás do Adega', taxa: 12 },
  { nome: 'Itaipus (1 ao 83)', taxa: 12 },
  { nome: 'Cond. Bentivi', taxa: 12 },
  { nome: 'Solar Itaipu', taxa: 12 },
  { nome: 'Capão Comprido', taxa: 17 },
  { nome: 'Morro da Cruz (após a Chácara 44)', taxa: 17 },
  { nome: 'Zumbi dos Palmares', taxa: 17 },
  { nome: 'Jardim da Serra', taxa: 17 },
  { nome: 'Mansões Califórnia', taxa: 18 },
  { nome: 'Jardim Botânico 1', taxa: 18 },
  { nome: 'Jardim Botânico 2', taxa: 18 },
  { nome: 'Jardim Botânico 4', taxa: 18 },
  { nome: 'Jardim Botânico 5', taxa: 18 },
  { nome: 'Jardim Botânico 6', taxa: 18 },
  { nome: 'San Diego', taxa: 18 },
  { nome: 'Quintas Bela Vista', taxa: 18 },
  { nome: 'Quintas do Sol', taxa: 18 },
  { nome: 'Inter Lagos', taxa: 18 },
  { nome: 'Mansões Serranas', taxa: 18 },
  { nome: 'Mirante e Jardim das Paineiras', taxa: 18 },
  { nome: 'Jardins do Lago Q.9', taxa: 18 },
  { nome: 'Ouro Vermelho 1', taxa: 18 },
  { nome: 'Amobb', taxa: 18 },
  { nome: 'Maxximo Garden', taxa: 18 },
  { nome: 'Belvedere Green', taxa: 18 },
  { nome: 'Condomínio Verde', taxa: 18 },
  { nome: 'São Matheus', taxa: 18 },
  { nome: 'Papuda', taxa: 22 },
  { nome: 'Caje', taxa: 22 },
  { nome: 'Jardim do Lago Q.1', taxa: 22 },
  { nome: 'Jardim do Lago Q.2', taxa: 22 },
  { nome: 'Solar de Brasília 1', taxa: 22 },
  { nome: 'Solar de Brasília 2', taxa: 22 },
  { nome: 'Condomínio Village 3', taxa: 22 },
  { nome: 'Solar de Brasília 3', taxa: 25 },
  { nome: 'Aguilhada', taxa: 25 },
  { nome: 'Cond. Caminho das Anta', taxa: 25 },
  { nome: 'Mônaco', taxa: 30 },
  { nome: 'Cond. Rural Privê', taxa: 30 },
  { nome: 'Lago Sul', taxa: 30 },
  { nome: 'Quintas do Trevo', taxa: 30 },
  { nome: 'Santa Bárbara', taxa: 30 },
  { nome: 'Ville de Montagne', taxa: 30 },
  { nome: 'QI 23', taxa: 30 },
  { nome: 'SMDB', taxa: 30 },
  { nome: 'QI 5 a QI 29 (exceto QI 23)', taxa: 40 },
  { nome: 'Quintas Alvorada', taxa: 40 },
  { nome: 'Solar da Serra', taxa: 40 },
  { nome: 'Mansões Itaipu', taxa: 40 },
  { nome: 'Altiplano Leste', taxa: 40 },
  { nome: 'Santa Mônica', taxa: 40 },
  { nome: 'San Francisco 1', taxa: 40 },
  { nome: 'San Francisco 2', taxa: 40 },
  { nome: 'Chapéu de Pedra', taxa: 40 },
  { nome: 'Le Jardim', taxa: 40 },
  { nome: 'Cond. Terra Azul', taxa: 40 },
  { nome: 'Parque do Mirante', taxa: 40 },
];

const ZONAS_ENTREGA_DONA_FIT: ZonaEntrega[] = [
  { nome: 'Lago Norte CA', taxa: 15, aliases: ['Lago Norte', 'CA'] },
  { nome: 'Sudoeste 2', taxa: 15 },
  { nome: 'Lago Norte 3', taxa: 20 },
  { nome: 'Sudoeste', taxa: 20 },
  { nome: 'Lago Norte 2', taxa: 25 },
  { nome: 'Península Lago Norte', taxa: 25, aliases: ['Peninsula Lago Norte'] },
  { nome: 'Asa Sul', taxa: 25 },
  { nome: 'Granja do Torto', taxa: 25 },
  { nome: 'Asa Norte', taxa: 30 },
  { nome: 'Guará', taxa: 30, aliases: ['Guara'] },
  { nome: 'Taquari', taxa: 30 },
  { nome: 'Águas Claras', taxa: 38, aliases: ['Aguas Claras'] },
  { nome: 'Riacho Fundo Park Way', taxa: 40, aliases: ['Park Way'] },
];

const CONFIGS_LOJAS_ESPECIAIS: Record<string, ConfigLojaEspecial> = {
  'dona-fit': {
    taxaEntregaFixa: 0,
    ocultarRetirada: false,
    zonasEntrega: ZONAS_ENTREGA_DONA_FIT,
    cidadeEntrega: 'Brasília - DF',
    whatsappAtendimento: '61996170808',
  },
  godog: {
    taxaEntregaFixa: 5,
    ocultarRetirada: true,
    limiteUnidadesComida: 3,
  },
  'perucho-burguer': {
    taxaEntregaFixa: 0,
    ocultarRetirada: false,
    zonasEntrega: ZONAS_ENTREGA_PERUCHO,
    cidadeEntrega: 'Brasília - DF',
    whatsappAtendimento: '61999684454', // WhatsApp de atendimento do Perucho (DDD + número)
  },
};

export function obterConfigLojaEspecial(slug: string | null | undefined): ConfigLojaEspecial {
  const chave = (slug ?? '').trim();
  return CONFIGS_LOJAS_ESPECIAIS[chave] ?? CONFIG_PADRAO;
}

export function normalizarNomeBairro(valor: string | null | undefined): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function lojaTemTaxaPorBairro(config: ConfigLojaEspecial): boolean {
  return (config.zonasEntrega?.length ?? 0) > 0;
}

export function encontrarZonaEntrega(config: ConfigLojaEspecial, bairro: string | null | undefined): ZonaEntrega | null {
  const alvo = normalizarNomeBairro(bairro);
  if (!alvo || !config.zonasEntrega) return null;
  return (
    config.zonasEntrega.find(
      (zona) =>
        normalizarNomeBairro(zona.nome) === alvo ||
        (zona.aliases ?? []).some((alias) => normalizarNomeBairro(alias) === alvo)
    ) ?? null
  );
}

export function sugerirZonaEntrega(config: ConfigLojaEspecial, texto: string | null | undefined): ZonaEntrega | null {
  const exata = encontrarZonaEntrega(config, texto);
  if (exata) return exata;
  return encontrarZonaEntrega(config, String(texto ?? '').replace(/\([^)]*\)/g, ' '));
}

export function faixaTaxasEntrega(config: ConfigLojaEspecial): { minima: number; maxima: number } | null {
  const taxas = (config.zonasEntrega ?? []).map((zona) => zona.taxa);
  if (taxas.length === 0) return null;
  return { minima: Math.min(...taxas), maxima: Math.max(...taxas) };
}

export type CalculoTaxaEntrega =
  | { ok: true; taxa: number; zona: ZonaEntrega | null }
  | { ok: false; erro: string };

export function calcularTaxaEntrega(
  config: ConfigLojaEspecial,
  tipoEntrega: string | null | undefined,
  bairro: string | null | undefined
): CalculoTaxaEntrega {
  if (tipoEntrega === 'RETIRADA') return { ok: true, taxa: 0, zona: null };
  if (!lojaTemTaxaPorBairro(config)) return { ok: true, taxa: config.taxaEntregaFixa, zona: null };

  const zona = encontrarZonaEntrega(config, bairro);
  if (!zona) {
    return {
      ok: false,
      erro: 'Selecione um bairro da lista de entrega. Se o seu bairro não aparece, escolha retirada no balcão ou fale com a loja.',
    };
  }
  return { ok: true, taxa: zona.taxa, zona };
}

export function ehBebida(nome: string) {
  return /coca|guaran[aá]|suco|[aá]gua|refrigerante|milk\s*-?shake|shake|sprite|limonada|ch[aá]/i.test(nome);
}
