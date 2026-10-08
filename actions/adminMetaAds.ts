'use server';

import { revalidatePath } from 'next/cache';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { listarContasAnunciosDoRestaurante, selecionarContaAnunciosMetaAds } from '@/utils/meta-ads';

export interface ContaAnunciosOpcao {
  id: string;
  nome: string;
  moeda: string | null;
  ativa: boolean;
}

export async function listarContasMetaAds(): Promise<
  { success: true; contas: ContaAnunciosOpcao[]; contaAtualId: string | null } | { success: false; error: string }
> {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    const { contas, contaAtualId } = await listarContasAnunciosDoRestaurante(restauranteId);
    return {
      success: true,
      contaAtualId,
      contas: contas.map((conta) => ({
        id: conta.id,
        nome: conta.name ?? conta.id,
        moeda: conta.currency ?? null,
        ativa: conta.account_status === 1,
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Falha ao listar contas de anúncios.' };
  }
}

export async function selecionarContaMetaAds(adAccountId: string) {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    await selecionarContaAnunciosMetaAds(restauranteId, adAccountId);
    revalidatePath('/admin/integracoes');
    revalidatePath('/admin/metricas');
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Falha ao trocar a conta.' };
  }
}
