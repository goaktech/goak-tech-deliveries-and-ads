import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { processarEventosIfood } from '@/utils/ifood-entrega';

export const INTERVALO_POLLING_IFOOD_MS = 30000;

const estado = globalThis as typeof globalThis & {
  __goakPollingIfood?: { timer: ReturnType<typeof setInterval>; emAndamento: boolean };
};

export function pollingContinuoIfoodAtivo() {
  return Boolean(estado.__goakPollingIfood);
}

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
    return;
  }

  const ciclo = async () => {
    const atual = estado.__goakPollingIfood;
    if (!atual || atual.emAndamento) return;
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
