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
const TENTATIVAS_CONFERIR_LOJA = 4;
const ESPERA_CONFERIR_LOJA_MS = 3000;

function mensagemDeErro(erro: unknown, padrao: string) {
  return erro instanceof Error ? erro.message : padrao;
}

async function integracaoAtual(restauranteId: string) {
  return paraIntegracaoIfoodPublica(await obterIntegracaoIfoodPorRestauranteId(restauranteId));
}

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

    let loja: Awaited<ReturnType<typeof buscarDadosLojaIfood>> | null = null;
    for (let tentativa = 1; tentativa <= TENTATIVAS_CONFERIR_LOJA && !loja; tentativa++) {
      loja = await buscarDadosLojaIfood(tokens.accessToken, integracao.merchant_id).catch(() => null);
      if (!loja && tentativa < TENTATIVAS_CONFERIR_LOJA) {
        await new Promise((resolve) => setTimeout(resolve, ESPERA_CONFERIR_LOJA_MS));
      }
    }

    if (!loja) {
      const autorizadas = await listarLojasAutorizadasIfood(tokens.accessToken).catch(() => []);
      console.error('Loja informada não aparece para o token do iFood:', {
        merchantId: integracao.merchant_id,
        autorizadas: autorizadas.map((item) => item.id),
      });
      if (autorizadas.length === 0) {
        return {
          success: false,
          error:
            'O iFood aceitou o código, mas ainda não liberou nenhuma loja para ele. Aguarde alguns minutos, gere um novo código e autorize de novo. Se continuar, confira no Portal do Parceiro se a integração aparece como ativa na loja.',
        };
      }
      const nomes = autorizadas.map((item) => item.name || item.id).join(', ');
      return {
        success: false,
        error: `A autorização foi feita para outra loja (${nomes}), não para o ID informado. Confira o ID ou entre no Portal do Parceiro com a conta da loja certa.`,
      };
    }

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

export async function salvarConfiguracaoEntregaIfood(ativo: boolean, acrescimo: number): Promise<Resultado> {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    const integracao = await obterIntegracaoIfoodPorRestauranteId(restauranteId);
    if (ativo && integracao?.connection_status !== 'conectado') {
      return { success: false, error: 'Conecte a loja do iFood antes de ligar as entregas pelo iFood.' };
    }

    const valor = Math.round(Number(acrescimo) * 100) / 100;
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
      return { success: false, error: 'Acréscimo inválido. Use um valor entre R$ 0,00 e R$ 100,00.' };
    }

    await salvarIntegracaoIfood(restauranteId, { entregas_pelo_ifood: ativo, acrescimo_taxa_entrega: valor });
    revalidatePath(PAGINA_INTEGRACOES);
    return { success: true, integracao: await integracaoAtual(restauranteId) };
  } catch (erro) {
    console.error('Erro ao salvar configuração de entregas pelo iFood:', erro);
    return { success: false, error: mensagemDeErro(erro, 'Falha ao salvar a configuração de entregas pelo iFood.') };
  }
}
