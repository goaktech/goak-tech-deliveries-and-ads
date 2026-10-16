import { NextResponse } from 'next/server';
import { obterRestauranteIdDoGestorLogado } from '@/utils/mercado-pago';
import { obterIntegracaoIfoodPorRestauranteId, obterStatusOperacaoLojaIfood } from '@/utils/ifood';

// Status de operação da loja do gestor logado no iFood (aberta, fechada, com
// pendência). Usado pelo card iFood em Integrações e pela cozinha.
export async function GET() {
  try {
    const restauranteId = await obterRestauranteIdDoGestorLogado();
    const integracao = await obterIntegracaoIfoodPorRestauranteId(restauranteId);
    if (!integracao?.merchant_id || integracao.connection_status !== 'conectado') {
      return NextResponse.json({ conectado: false, operacoes: [] });
    }
    return NextResponse.json({
      conectado: true,
      operacoes: await obterStatusOperacaoLojaIfood(restauranteId),
      consultadoEm: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao consultar o status da loja no iFood:', error);
    const mensagem = error instanceof Error ? error.message : 'Erro ao consultar o status da loja no iFood.';
    return NextResponse.json({ conectado: true, operacoes: [], error: mensagem }, { status: 200 });
  }
}
