'use server';

import { createClient } from '@/utils/supabase/server';
import { Insumo } from '@/types/database';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Erro desconhecido.';
}

async function obterRestauranteIdLogado(): Promise<string> {
  const supabase = await createClient();
  
  const { data: { user }, error: errUser } = await supabase.auth.getUser();
  
  if (errUser || !user) {
    throw new Error('Usuário não autenticado no Centro de Comando.');
  }

  const { data: perfil, error: errPerfil } = await supabase
    .from('perfis_admin')
    .select('restaurante_id')
    .eq('id', user.id)
    .single();

  if (errPerfil || !perfil) {
    throw new Error('Perfil administrativo ou restaurante não localizado.');
  }

  return perfil.restaurante_id;
}

export async function listarInsumosAdmin(): Promise<Insumo[]> {
  try {
    const supabase = await createClient();
    const restauranteId = await obterRestauranteIdLogado();
    
    const { data, error } = await supabase
      .from('insumos')
      .select('*')
      .eq('restaurante_id', restauranteId)
      .order('nome', { ascending: true });

    if (error) {
      console.error('Erro ao listar insumos:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Erro na action listarInsumosAdmin:', error);
    return [];
  }
}

export async function criarInsumoAdmin(
  nome: string, 
  unidade: 'g' | 'ml' | 'un', 
  custo: number, 
  estoqueAtual: number, 
  estoqueMinimo: number
) {
  if (!nome || custo <= 0) {
    return { success: false, error: 'Nome e custo unitário são obrigatórios.' };
  }

  try {
    const supabase = await createClient();
    const restauranteId = await obterRestauranteIdLogado();
    
    const { error } = await supabase
      .from('insumos')
      .insert([
        {
          restaurante_id: restauranteId,
          nome,
          unidade_medida: unidade,
          custo_unitario: custo,
          estoque_atual: estoqueAtual,
          estoque_minimo: estoqueMinimo
        }
      ]);

    if (error) {
      console.error('Erro ao criar insumo:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function excluirInsumosEmLote(ids: string[]) {
  if (ids.length === 0) return { success: true };

  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('insumos')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Erro ao excluir insumos em lote:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function atualizarCustoInsumoAdmin(
  id: string,
  nome: string,
  novoCusto: number,
  estoqueAtual: number,
  estoqueMinimo: number
) {
  if (!id || !nome.trim() || novoCusto <= 0) {
    return { success: false, error: 'Dados inválidos para atualização.' };
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('insumos')
      .update({
        nome: nome.trim(),
        custo_unitario: novoCusto,
        estoque_atual: estoqueAtual,
        estoque_minimo: estoqueMinimo
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar custo do insumo:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}
