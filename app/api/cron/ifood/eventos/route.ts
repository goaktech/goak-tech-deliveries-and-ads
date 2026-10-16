import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { processarEventosIfoodDeTodasAsLojas } from '@/utils/ifood-polling';

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(request.headers.get('authorization') ?? '');
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  try {
    return NextResponse.json(await processarEventosIfoodDeTodasAsLojas());
  } catch (error) {
    console.error('Erro no cron de eventos do iFood:', error);
    return NextResponse.json({ error: 'Falha no polling de eventos do iFood.' }, { status: 500 });
  }
}
