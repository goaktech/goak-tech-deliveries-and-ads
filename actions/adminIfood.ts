// actions/adminIfood.ts
'use server';

import { revalidatePath } from 'next/cache';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import {
  type IntegracaoIfoodPublica,
  buscarDadosLojaIfood,
  expiracaoDoToken,
  gerarUserCodeIfood,
  listarLojasAutorizadasIfood,
  merchantIdValido,
  obterAccessTokenIfood,
  obterIntegracaoIfoodPorRestauranteId,
  paraIntegracaoIfoodPublica,
  salvarIntegracaoIfood,
  trocarAuthorizationCodeIfood,
} from '@/utils/ifood';

type Resultado = { success: true; integracao: IntegracaoIfoodPublica | null } | { success: false; error: string };

const PAGINA_INTEGRACOES = '/admin/integracoes';

function mensagemDeErro(erro: unknown, padrao: string) {
  return erro instanceof Error ? erro.message : padrao;
}

async function integracaoAtual(restauranteId: string) {
  return paraIntegracaoIfoodPublica(await obterIntegracaoIfoodPorRestauranteId(restauranteId));
}

/**
 * Passo 1: gestor informou o ID da loja. Gera o código de vínculo que o
 * lojista vai aprovar no Portal do Parceiro. O verifier fica só no banco.
 */
export async function iniciarConexaoIfood(merchantId: string): Promise<Resultado> {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    const id = merchantId.trim().toLowerCase();

    if (!merchantIdValido(id)) {
      return {
        success: false,
        error: 'ID da loja inválido. Copie o ID no Portal do Parceiro iFood (formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).',
      };
    }

    const codigo = await gerarUserCodeIfood();
    await salvarIntegracaoIfood(restauranteId, {
      merchant_id: id,
      connection_status: 'pendente',
      authorization_code_verifier: codigo.authorizationCodeVerifier,
      user_code: codigo.userCode,
      verification_url: codigo.verificationUrlComplete ?? codigo.verificationUrl ?? null,
      user_code_expires_at: expiracaoDoToken(codigo.expiresIn),
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
    });

    revalidatePath(PAGINA_INTEGRACOES);
    return { success: true, integracao: await integracaoAtual(restauranteId) };
  } catch (erro) {
    console.error('Erro ao iniciar conexão iFood:', erro);
    return { success: false, error: mensagemDeErro(erro, 'Falha ao iniciar conexão com o iFood.') };
  }
}

/**
 * Passo 2: lojista aprovou e colou o código de autorização. Troca por
 * tokens, confere que a loja autorizada é a do ID informado e puxa os
 * dados cadastrais dela.
 */
export async function concluirConexaoIfood(authorizationCode: string): Promise<Resultado> {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    const integracao = await obterIntegracaoIfoodPorRestauranteId(restauranteId);
    const codigo = authorizationCode.trim();

    if (!integracao?.merchant_id || !integracao.authorization_code_verifier) {
      return { success: false, error: 'Informe o ID da loja e gere o código de vínculo primeiro.' };
    }
    if (!codigo) {
      return { success: false, error: 'Cole o código de autorização exibido no Portal do Parceiro.' };
    }

    const tokens = await trocarAuthorizationCodeIfood(codigo, integracao.authorization_code_verifier);

    const autorizadas = await listarLojasAutorizadasIfood(tokens.accessToken);
    if (!autorizadas.some((loja) => loja.id === integracao.merchant_id)) {
      const nomes = autorizadas.map((loja) => loja.name || loja.id).join(', ') || 'nenhuma';
      return {
        success: false,
        error: `A autorização foi feita para outra loja (${nomes}), não para o ID informado. Confira o ID ou entre no Portal do Parceiro com a conta da loja certa.`,
      };
    }

    const loja = await buscarDadosLojaIfood(tokens.accessToken, integracao.merchant_id);
    await salvarIntegracaoIfood(restauranteId, {
      connection_status: 'conectado',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? null,
      token_expires_at: expiracaoDoToken(tokens.expiresIn),
      authorization_code_verifier: null,
      user_code: null,
      verification_url: null,
      user_code_expires_at: null,
      merchant_nome: loja.nome,
      merchant_razao_social: loja.razaoSocial,
      merchant_status: loja.status,
      merchant_endereco: loja.endereco,
      dados_atualizados_em: new Date().toISOString(),
    });

    revalidatePath(PAGINA_INTEGRACOES);
    return { success: true, integracao: await integracaoAtual(restauranteId) };
  } catch (erro) {
    console.error('Erro ao concluir conexão iFood:', erro);
    return { success: false, error: mensagemDeErro(erro, 'Falha ao concluir conexão com o iFood.') };
  }
}

/** Puxa de novo nome, endereço e status da loja no iFood. */
export async function atualizarDadosLojaIfood(): Promise<Resultado> {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    const integracao = await obterIntegracaoIfoodPorRestauranteId(restauranteId);
    if (!integracao?.merchant_id) {
      return { success: false, error: 'Nenhuma loja iFood conectada.' };
    }

    const accessToken = await obterAccessTokenIfood(restauranteId);
    const loja = await buscarDadosLojaIfood(accessToken, integracao.merchant_id);
    await salvarIntegracaoIfood(restauranteId, {
      merchant_nome: loja.nome,
      merchant_razao_social: loja.razaoSocial,
      merchant_status: loja.status,
      merchant_endereco: loja.endereco,
      dados_atualizados_em: new Date().toISOString(),
    });

    revalidatePath(PAGINA_INTEGRACOES);
    return { success: true, integracao: await integracaoAtual(restauranteId) };
  } catch (erro) {
    console.error('Erro ao atualizar dados da loja iFood:', erro);
    revalidatePath(PAGINA_INTEGRACOES);
    return { success: false, error: mensagemDeErro(erro, 'Falha ao atualizar dados da loja iFood.') };
  }
}

/** Apaga os tokens do goak. O lojista também pode revogar no Portal do Parceiro. */
export async function desconectarIfood(): Promise<Resultado> {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    await salvarIntegracaoIfood(restauranteId, {
      connection_status: 'desconectado',
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      authorization_code_verifier: null,
      user_code: null,
      verification_url: null,
      user_code_expires_at: null,
    });

    revalidatePath(PAGINA_INTEGRACOES);
    return { success: true, integracao: await integracaoAtual(restauranteId) };
  } catch (erro) {
    console.error('Erro ao desconectar iFood:', erro);
    return { success: false, error: mensagemDeErro(erro, 'Falha ao desconectar o iFood.') };
  }
}
