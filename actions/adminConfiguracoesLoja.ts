'use server';

import { createClient } from '@/utils/supabase/server';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { revalidatePath } from 'next/cache';
import type { HorarioFuncionamentoDia } from '@/utils/horario-funcionamento';
import { FORMAS_PAGAMENTO_LOJA, ehFormaPagamentoLoja } from '@/utils/formas-pagamento';

export interface ConfiguracaoTempoPreparoInput {
  tempoPreparoBaseMinutos: number;
  tempoPreparoIncrementoMinutos: number;
  tempoPreparoTetoMinutos: number;
}

function validarConfiguracao(config: ConfiguracaoTempoPreparoInput): string | null {
  const { tempoPreparoBaseMinutos, tempoPreparoIncrementoMinutos, tempoPreparoTetoMinutos } = config;

  if (
    !Number.isInteger(tempoPreparoBaseMinutos) ||
    !Number.isInteger(tempoPreparoIncrementoMinutos) ||
    !Number.isInteger(tempoPreparoTetoMinutos)
  ) {
    return 'Os tempos precisam ser números inteiros de minutos.';
  }

  if (tempoPreparoBaseMinutos < 0 || tempoPreparoIncrementoMinutos < 0 || tempoPreparoTetoMinutos < 0) {
    return 'Os tempos não podem ser negativos.';
  }

  if (tempoPreparoTetoMinutos < tempoPreparoBaseMinutos) {
    return 'O teto máximo precisa ser maior ou igual ao tempo base.';
  }

  if (tempoPreparoBaseMinutos > 240 || tempoPreparoTetoMinutos > 240) {
    return 'Os tempos parecem grandes demais (acima de 4 horas). Confira os valores.';
  }

  return null;
}

export async function atualizarTempoPreparoLoja(config: ConfiguracaoTempoPreparoInput) {
  const erroValidacao = validarConfiguracao(config);
  if (erroValidacao) {
    return { success: false, error: erroValidacao };
  }

  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = await createClient();

  const { data: restaurante, error: errRestaurante } = await supabase
    .from('restaurantes')
    .select('slug')
    .eq('id', restauranteId)
    .single();

  if (errRestaurante || !restaurante) {
    return { success: false, error: 'Restaurante não encontrado.' };
  }

  const { error } = await supabase
    .from('restaurantes')
    .update({
      tempo_preparo_base_minutos: config.tempoPreparoBaseMinutos,
      tempo_preparo_incremento_minutos: config.tempoPreparoIncrementoMinutos,
      tempo_preparo_teto_minutos: config.tempoPreparoTetoMinutos,
    })
    .eq('id', restauranteId);

  if (error) {
    return { success: false, error: `Erro ao salvar configuração: ${error.message}` };
  }

  revalidatePath('/admin/configuracoes');

  return { success: true };
}

const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function validarHorariosFuncionamento(horarios: HorarioFuncionamentoDia[]): string | null {
  if (!Array.isArray(horarios) || horarios.length !== 7) {
    return 'Informe o horário dos 7 dias da semana.';
  }

  const diasVistos = new Set<number>();
  for (const horario of horarios) {
    if (!Number.isInteger(horario.dia) || horario.dia < 0 || horario.dia > 6 || diasVistos.has(horario.dia)) {
      return 'Dias da semana inválidos ou duplicados.';
    }
    diasVistos.add(horario.dia);

    if (horario.ativo && (!REGEX_HORA.test(horario.abertura) || !REGEX_HORA.test(horario.fechamento))) {
      return 'Horário de abertura/fechamento inválido. Use o formato HH:MM.';
    }
  }

  return null;
}

export async function atualizarHorarioFuncionamentoLoja(horarios: HorarioFuncionamentoDia[]) {
  const erroValidacao = validarHorariosFuncionamento(horarios);
  if (erroValidacao) {
    return { success: false, error: erroValidacao };
  }

  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = await createClient();

  const { data: restaurante, error: errRestaurante } = await supabase
    .from('restaurantes')
    .select('slug')
    .eq('id', restauranteId)
    .single();

  if (errRestaurante || !restaurante) {
    return { success: false, error: 'Restaurante não encontrado.' };
  }

  const { error } = await supabase
    .from('restaurantes')
    .update({ horarios_funcionamento: horarios })
    .eq('id', restauranteId);

  if (error) {
    return { success: false, error: `Erro ao salvar horário de funcionamento: ${error.message}` };
  }

  revalidatePath('/admin/configuracoes');
  revalidatePath(`/${restaurante.slug}`);

  return { success: true };
}

export async function atualizarEnderecoLoja(endereco: string, latitude: number | null, longitude: number | null) {
  const enderecoLimpo = endereco.trim();
  if (!enderecoLimpo) {
    return { success: false, error: 'Informe o endereço da loja.' };
  }

  if (latitude == null || longitude == null) {
    return { success: false, error: 'Marque a localização da loja no mapa antes de salvar.' };
  }

  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabase = await createClient();

  const { data: restaurante, error: errRestaurante } = await supabase
    .from('restaurantes')
    .select('slug')
    .eq('id', restauranteId)
    .single();

  if (errRestaurante || !restaurante) {
    return { success: false, error: 'Restaurante não encontrado.' };
  }

  const { error } = await supabase
    .from('restaurantes')
    .update({ endereco: enderecoLimpo, latitude, longitude })
    .eq('id', restauranteId);

  if (error) {
    return { success: false, error: `Erro ao salvar endereço: ${error.message}` };
  }

  revalidatePath('/admin/configuracoes');
  revalidatePath(`/${restaurante.slug}`);
  revalidatePath(`/${restaurante.slug}/checkout`);

  return { success: true };
}

export async function atualizarFormasPagamentoLoja(formas: string[]) {
  if (!Array.isArray(formas) || !formas.every(ehFormaPagamentoLoja)) {
    return { success: false, error: 'Forma de pagamento inválida.' };
  }

  // sem repetição e em ordem fixa, independente da ordem em que o gestor clicou
  const formasNormalizadas = FORMAS_PAGAMENTO_LOJA.filter((forma) => formas.includes(forma));
  if (formasNormalizadas.length === 0) {
    return { success: false, error: 'Escolha pelo menos uma forma de pagamento.' };
  }

  // O id da loja vem SEMPRE da sessão do gestor logado (nunca do formulário). A gravação usa o
  // cliente administrativo porque o papel `authenticated` só tem UPDATE em colunas específicas
  // de `restaurantes` (ver o erro "permission denied for table restaurantes") — mesmo padrão
  // da rota de upload de logo.
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const supabaseAdmin = createWebhookAdminClient();

  const { error } = await supabaseAdmin
    .from('restaurantes')
    .update({ formas_pagamento_aceitas: formasNormalizadas })
    .eq('id', restauranteId);

  if (error) {
    return { success: false, error: `Erro ao salvar formas de pagamento: ${error.message}` };
  }

  revalidatePath('/admin/integracoes');

  return { success: true, formas: formasNormalizadas };
}
