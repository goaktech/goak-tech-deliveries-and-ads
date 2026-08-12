import { NextResponse } from 'next/server';
import { geocodificarReverso } from '@/utils/google-maps';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 });
    }

    const endereco = await geocodificarReverso({ latitude, longitude });
    return NextResponse.json({ endereco });
  } catch (error) {
    console.error('Erro na rota de geocodificação reversa:', error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
