// utils/ifood-polling.ts
// Polling contínuo dos eventos do iFood, no servidor: roda a cada 30 s para
// todas as lojas conectadas, com ou sem a tela da cozinha aberta. O iFood
// considera a loja "conectada" (validação is-connected do status) enquanto o
// polling chega nesse intervalo.
//
// Duas formas de disparo:
//   - processo Node contínuo (npm run dev / next start): instrumentation.ts
//     chama iniciarPollingContinuoIfood() na subida do servidor;
//   - serverless (sem processo contínuo): um agendador externo chama
//     POST /api/cron/ifood/eventos a cada 30 s.

import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { processarEventosIfood } from '@/utils/ifood-entrega';

export const INTERVALO_POLLING_IFOOD_MS = 30000;

// Em globalThis: o hot reload do dev recarrega o módulo, e o timer não pode duplicar.
const estado = globalThis as typeof globalThis & {
  __goakPollingIfood?: { timer: ReturnType<typeof setInterval>; emAndamento: boolean };
};

/** O laço de polling está rodando neste processo? */
export function pollingContinuoIfoodAtivo() {
  return Boolean(estado.__goakPollingIfood);
}

/** Um ciclo de polling: busca e confirma os eventos de cada loja conectada. */
export async function processarEventosIfoodDeTodasAsLojas() {
  const { data, error } = await createWebhookAdminClient()
    .from('restaurante_integracoes_ifood')
    .select('restaurante_id')
    .eq('connection_status', 'conectado')
    .not('merchant_id', 'is', null);

  if (error) {
    throw new Error(`Falha ao listar lojas iFood conectadas: ${error.message}`);
  }

  const resultados = await Promise.allSettled(
    (data ?? []).map((linha) => processarEventosIfood(linha.restaurante_id as string))
  );

  let novos = 0;
  let falhas = 0;
  for (const resultado of resultados) {
    if (resultado.status === 'fulfilled') {
      novos += resultado.value.novos;
    } else {
      falhas += 1;
      console.error('Falha no polling de eventos do iFood de uma loja:', resultado.reason);
    }
  }
  return { lojas: resultados.length, novos, falhas };
}

export function iniciarPollingContinuoIfood() {
  if (estado.__goakPollingIfood || process.env.IFOOD_POLLING_CONTINUO === 'false') {
    return;
  }
  if (!process.env.IFOOD_CLIENT_ID || !process.env.IFOOD_CLIENT_SECRET) {
    return; // iFood não configurado neste ambiente
  }

  const ciclo = async () => {
    const atual = estado.__goakPollingIfood;
    if (!atual || atual.emAndamento) return; // ciclo anterior ainda rodando (retry/backoff)
    atual.emAndamento = true;
    try {
      await processarEventosIfoodDeTodasAsLojas();
    } catch (erro) {
      console.error('Falha no polling contínuo do iFood:', erro);
    } finally {
      atual.emAndamento = false;
    }
  };

  const timer = setInterval(() => void ciclo(), INTERVALO_POLLING_IFOOD_MS);
  timer.unref?.();
  estado.__goakPollingIfood = { timer, emAndamento: false };
  void ciclo();
  console.log(`Polling contínuo de eventos do iFood iniciado (a cada ${INTERVALO_POLLING_IFOOD_MS / 1000} s).`);
}
