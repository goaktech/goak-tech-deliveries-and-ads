import { NextResponse } from 'next/server';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { processarEventosIfood } from '@/utils/ifood-entrega';
import { clientIdIfoodHomologacao, obterIntegracaoIfoodPorRestauranteId } from '@/utils/ifood';
import { pollingContinuoIfoodAtivo } from '@/utils/ifood-polling';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

// A cozinha chama esta rota para saber se a loja está conectada ao iFood.
// O polling de eventos em si roda no servidor a cada 30 s (utils/ifood-polling.ts),
// sem depender desta tela. Só quando esse laço não existe (serverless sem o
// cron configurado) a chamada da cozinha faz o polling, como reserva.
export async function POST() {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    const clientIdHomologacao = clientIdIfoodHomologacao();

    if (pollingContinuoIfoodAtivo()) {
      const integracao = await obterIntegracaoIfoodPorRestauranteId(restauranteId);
      const conectado = Boolean(integracao?.merchant_id && integracao.connection_status === 'conectado');
      // Último evento gravado pelo laço: a cozinha recarrega a lista quando ele muda.
      const { data: ultimo } = await createWebhookAdminClient()
        .from('eventos_ifood')
        .select('event_id')
        .eq('restaurante_id', restauranteId)
        .order('recebido_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      return NextResponse.json({ conectado, novos: 0, ultimoEvento: ultimo?.event_id ?? null, clientIdHomologacao });
    }

    return NextResponse.json({ ...(await processarEventosIfood(restauranteId)), clientIdHomologacao });
  } catch (error) {
    console.error('Erro no polling de eventos do iFood:', error);
    const mensagem = error instanceof Error ? error.message : 'Erro ao buscar eventos do iFood.';
    return NextResponse.json({ conectado: false, novos: 0, error: mensagem }, { status: 200 });
  }
}
