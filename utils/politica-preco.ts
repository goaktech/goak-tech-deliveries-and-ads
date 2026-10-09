import type { SupabaseClient } from '@supabase/supabase-js';
import type { HorarioFuncionamentoDia } from '@/utils/horario-funcionamento';

/**
 * Política de preço do checkout.
 *
 * O cliente paga o preço que VIU na vitrine (CDC art. 30: a oferta com preço claro vincula o
 * fornecedor). Se o gestor mudou o preço depois, o preço visto continua valendo até o fim do
 * expediente do dia em que a mudança foi feita (janela abaixo). Fora dessa janela, o carrinho é
 * atualizado com aviso e o cliente confirma o novo valor antes de pagar. Preço que ficou MENOR
 * sempre vale o menor. Item/adicional que deixou de existir bloqueia o pagamento com mensagem.
 *
 * O preço "visto" vem do navegador, mas só é honrado se for IGUAL a uma versão que realmente
 * existiu (historico_precos_item): o cliente não consegue escolher um valor qualquer.
 */

export interface AdicionalVisto {
  id: string;
  nome: string;
}

export interface ItemParaAvaliar {
  idUnico?: string;
  item_cardapio_id: string;
  quantidade: number;
  complementoIds?: string[];
  adicionaisVistos?: AdicionalVisto[];
  /** Preço unitário (já com adicionais) que o cliente viu. */
  precoVisto?: number;
}

export type StatusAvaliacaoItem =
  | 'ok'
  | 'preco_menor'
  | 'preco_mantido'
  | 'preco_alterado'
  | 'indisponivel'
  | 'adicional_indisponivel';

export interface AdicionalResolvido {
  id: string;
  nome: string;
  preco_adicional: number;
}

export interface AvaliacaoItem {
  idUnico?: string;
  item_cardapio_id: string;
  nome: string;
  status: StatusAvaliacaoItem;
  precoVisto: number | null;
  precoAtual: number;
  /** Preço unitário que será cobrado (só vale quando o status não bloqueia). */
  precoCobrado: number;
  adicionais: AdicionalResolvido[];
}

export const STATUS_QUE_BLOQUEIAM: StatusAvaliacaoItem[] = ['preco_alterado', 'indisponivel', 'adicional_indisponivel'];

const TOLERANCIA = 0.005;
const FUSO = 'America/Sao_Paulo';
const MAX_JANELA_MS = 24 * 60 * 60 * 1000;
const JANELA_SEM_HORARIO_MS = 12 * 60 * 60 * 1000;

function iguais(a: number, b: number) {
  return Math.abs(a - b) < TOLERANCIA;
}

function normalizarNome(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function minutos(horaMinuto: string) {
  const [h, m] = horaMinuto.split(':').map(Number);
  return h * 60 + (m || 0);
}

function partesBrasilia(instante: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instante);
  const pegar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '0';
  const mapaDias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    ano: Number(pegar('year')),
    mes: Number(pegar('month')),
    dia: Number(pegar('day')),
    diaSemana: mapaDias[pegar('weekday')] ?? 0,
    hora: Number(pegar('hour')) % 24,
    minuto: Number(pegar('minute')),
  };
}

/** Instante (UTC) de um horário "HH:MM" de Brasília, `diasAtras` dias antes de hoje. Brasília é UTC-3 o ano todo. */
function instanteAbertura(agora: Date, diasAtras: number, horaMinuto: string) {
  const p = partesBrasilia(agora);
  const m = minutos(horaMinuto);
  return new Date(Date.UTC(p.ano, p.mes - 1, p.dia - diasAtras, Math.floor(m / 60) + 3, m % 60));
}

/**
 * Início da janela em que uma troca de preço ainda é honrada: a abertura do expediente em curso
 * (hoje, ou ontem se a loja virou a madrugada), nunca mais de 24 h atrás. Sem horários cadastrados,
 * as últimas 12 h.
 */
export function inicioJanelaPreco(horarios: HorarioFuncionamentoDia[] | null | undefined, agora = new Date()): Date {
  const piso = new Date(agora.getTime() - MAX_JANELA_MS);
  const semHorario = new Date(agora.getTime() - JANELA_SEM_HORARIO_MS);
  if (!horarios || horarios.length === 0) return semHorario;

  const { diaSemana } = partesBrasilia(agora);
  const candidatos: Date[] = [];
  for (const diasAtras of [0, 1]) {
    const dia = (diaSemana - diasAtras + 7) % 7;
    const horario = horarios.find((h) => h.dia === dia && h.ativo);
    if (!horario) continue;
    const abertura = instanteAbertura(agora, diasAtras, horario.abertura);
    if (abertura.getTime() <= agora.getTime()) candidatos.push(abertura);
  }
  if (candidatos.length === 0) return semHorario;
  const maisRecente = candidatos.reduce((a, b) => (a.getTime() > b.getTime() ? a : b));
  return maisRecente.getTime() < piso.getTime() ? piso : maisRecente;
}

interface LinhaProduto {
  id: string;
  nome: string;
  preco_venda: number | string;
  disponivel: boolean | null;
  arquivado: boolean | null;
}

interface LinhaComplemento {
  id: string;
  item_cardapio_id: string;
  nome: string;
  preco_adicional: number | string;
  disponivel: boolean | null;
}

interface LinhaHistorico {
  item_cardapio_id: string;
  preco_venda: number | string;
  adicionais: Array<{ nome?: string; preco?: number | string }> | null;
  substituido_em: string;
}

export async function avaliarItensCarrinho(params: {
  supabase: SupabaseClient;
  restauranteId: string;
  horarios: HorarioFuncionamentoDia[] | null | undefined;
  itens: ItemParaAvaliar[];
  agora?: Date;
}): Promise<AvaliacaoItem[]> {
  const { supabase, restauranteId, horarios, itens } = params;
  const agora = params.agora ?? new Date();
  const idsProdutos = Array.from(new Set(itens.map((i) => i.item_cardapio_id)));

  const { data: produtosBanco, error: erroProdutos } = await supabase
    .from('itens_cardapio')
    .select('id, nome, preco_venda, disponivel, arquivado')
    .eq('restaurante_id', restauranteId)
    .in('id', idsProdutos);
  if (erroProdutos) throw erroProdutos;
  const produtoPorId = new Map(((produtosBanco ?? []) as LinhaProduto[]).map((p) => [p.id, p]));

  const { data: complementosBanco, error: erroComplementos } = await supabase
    .from('complementos_produto')
    .select('id, item_cardapio_id, nome, preco_adicional, disponivel')
    .in('item_cardapio_id', idsProdutos);
  if (erroComplementos) throw erroComplementos;
  const complementos = (complementosBanco ?? []) as LinhaComplemento[];

  // Histórico: se a tabela ainda não existe (migration pendente), segue sem honrar preços antigos.
  let historico: LinhaHistorico[] = [];
  const inicioJanela = inicioJanelaPreco(horarios, agora);
  const { data: historicoBanco, error: erroHistorico } = await supabase
    .from('historico_precos_item')
    .select('item_cardapio_id, preco_venda, adicionais, substituido_em')
    .eq('restaurante_id', restauranteId)
    .in('item_cardapio_id', idsProdutos)
    .gte('substituido_em', inicioJanela.toISOString());
  if (erroHistorico) {
    console.error('Histórico de preços indisponível (aplique a migration historico_precos_item):', erroHistorico.message);
  } else {
    historico = (historicoBanco ?? []) as LinhaHistorico[];
  }

  return itens.map((item): AvaliacaoItem => {
    const produto = produtoPorId.get(item.item_cardapio_id);
    const precoVisto = typeof item.precoVisto === 'number' && Number.isFinite(item.precoVisto) ? item.precoVisto : null;

    if (!produto || produto.arquivado || produto.disponivel === false) {
      return {
        idUnico: item.idUnico,
        item_cardapio_id: item.item_cardapio_id,
        nome: produto?.nome ?? 'Produto',
        status: 'indisponivel',
        precoVisto,
        precoAtual: produto ? Number(produto.preco_venda) : 0,
        precoCobrado: 0,
        adicionais: [],
      };
    }

    const doItem = complementos.filter((c) => c.item_cardapio_id === produto.id);
    const pedidos: AdicionalVisto[] =
      item.adicionaisVistos && item.adicionaisVistos.length > 0
        ? item.adicionaisVistos
        : (item.complementoIds ?? []).map((id) => ({ id, nome: doItem.find((c) => c.id === id)?.nome ?? '' }));

    const resolvidos: AdicionalResolvido[] = [];
    let adicionalIndisponivel = false;
    for (const pedido of pedidos) {
      // O gestor recria os adicionais ao editar o produto (ids novos): casa pelo id e, se não achar, pelo nome.
      const encontrado =
        doItem.find((c) => c.id === pedido.id) ??
        (pedido.nome ? doItem.find((c) => normalizarNome(c.nome) === normalizarNome(pedido.nome)) : undefined);
      if (!encontrado || encontrado.disponivel === false) {
        adicionalIndisponivel = true;
        continue;
      }
      resolvidos.push({ id: encontrado.id, nome: encontrado.nome, preco_adicional: Number(encontrado.preco_adicional) });
    }

    const precoBase = Number(produto.preco_venda);
    const precoAtual = Math.round((precoBase + resolvidos.reduce((s, a) => s + a.preco_adicional, 0)) * 100) / 100;
    const base = {
      idUnico: item.idUnico,
      item_cardapio_id: produto.id,
      nome: produto.nome,
      precoVisto,
      precoAtual,
      adicionais: resolvidos,
    };

    if (adicionalIndisponivel) {
      return { ...base, status: 'adicional_indisponivel', precoCobrado: 0 };
    }
    if (precoVisto === null || iguais(precoVisto, precoAtual)) {
      return { ...base, status: 'ok', precoCobrado: precoAtual };
    }
    if (precoVisto > precoAtual) {
      return { ...base, status: 'preco_menor', precoCobrado: precoAtual };
    }

    // O preço subiu desde que o cliente viu: honra se ele bate com uma versão real da janela.
    const honrado = historico
      .filter((h) => h.item_cardapio_id === produto.id)
      .some((h) => {
        const adicionaisAntigos = h.adicionais ?? [];
        let total = Number(h.preco_venda);
        for (const adicional of resolvidos) {
          const antigo = adicionaisAntigos.find((a) => normalizarNome(String(a.nome ?? '')) === normalizarNome(adicional.nome));
          if (!antigo) return false;
          total += Number(antigo.preco ?? 0);
        }
        return iguais(total, precoVisto);
      });

    return honrado
      ? { ...base, status: 'preco_mantido', precoCobrado: precoVisto }
      : { ...base, status: 'preco_alterado', precoCobrado: precoAtual };
  });
}
