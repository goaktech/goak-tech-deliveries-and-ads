'use server';

import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { atualizarStatusAtivoEntregador, criarEntregador, listarEntregadores } from '@/utils/entregadores';
import { revalidatePath } from 'next/cache';

export async function listarEntregadoresAdmin() {
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  return listarEntregadores(restauranteId);
}

export async function criarEntregadorAdmin(nome: string, telefone: string) {
  const restauranteId = await obterRestauranteIdDoGestorLogado();

  const nomeLimpo = nome.trim();
  const telefoneLimpo = telefone.trim();

  if (!nomeLimpo) {
    return { success: false, error: 'Informe o nome do entregador.' };
  }
  if (!telefoneLimpo) {
    return { success: false, error: 'Informe o telefone do entregador.' };
  }

  try {
    const entregador = await criarEntregador(restauranteId, nomeLimpo, telefoneLimpo);
    revalidatePath('/admin/entregadores');
    return { success: true, entregador };
  } catch (error) {
    console.error('Falha ao criar entregador:', error);
    return { success: false, error: 'Falha ao criar entregador.' };
  }
}

export async function alternarAtivoEntregadorAdmin(entregadorId: string, ativo: boolean) {
  const restauranteId = await obterRestauranteIdDoGestorLogado();
  const resultado = await atualizarStatusAtivoEntregador(restauranteId, entregadorId, ativo);
  revalidatePath('/admin/entregadores');
  return resultado;
}
