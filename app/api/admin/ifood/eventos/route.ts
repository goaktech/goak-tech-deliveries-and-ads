import { NextResponse } from 'next/server';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { processarEventosIfood } from '@/utils/ifood-entrega';

// Polling de eventos do iFood da loja do gestor logado. A cozinha chama a
// cada 30s enquanto estiver aberta (o goak roda serverless, sem processo
// contínuo). Também diz se a loja está conectada ao iFood.
export async function POST() {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    return NextResponse.json(await processarEventosIfood(restauranteId));
  } catch (error) {
    console.error('Erro no polling de eventos do iFood:', error);
    const mensagem = error instanceof Error ? error.message : 'Erro ao buscar eventos do iFood.';
    return NextResponse.json({ conectado: false, novos: 0, error: mensagem }, { status: 200 });
  }
}
