import { NextResponse } from 'next/server';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { processarEventosIfood } from '@/utils/ifood-entrega';
import { clientIdIfoodHomologacao, obterIntegracaoIfoodPorRestauranteId } from '@/utils/ifood';
import { pollingContinuoIfoodAtivo } from '@/utils/ifood-polling';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

export async function POST() {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    const clientIdHomologacao = clientIdIfoodHomologacao();

    if (pollingContinuoIfoodAtivo()) {
      const integracao = await obterIntegracaoIfoodPorRestauranteId(restauranteId);
      const conectado = Boolean(integracao?.merchant_id && integracao.connection_status === 'conectado');
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
