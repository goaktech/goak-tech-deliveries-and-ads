import { NextResponse } from 'next/server';
import { APP_BRAND_NAME } from '@/utils/branding';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
      return NextResponse.json({ error: 'Coordenadas ausentes' }, { status: 400 });
    }

    const subdominioApi = 'nominatim.';
    const dominioBase = 'openstreetmap.org';
    const rotaEndpoint = '/reverse?format=json';
    
    const urlFinal = `https://${subdominioApi}${dominioBase}${rotaEndpoint}&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    
    const resposta = await fetch(urlFinal, {
      headers: {
        'User-Agent': `${APP_BRAND_NAME}/1.0`,
        'Accept': 'application/json'
      }
    });

    if (!resposta.ok) {
      return NextResponse.json({ error: 'Erro na API externa de mapas' }, { status: resposta.status });
    }

    const dados = await resposta.json();
    return NextResponse.json(dados);
  } catch (error) {
    console.error('Erro critico no proxy de geolocalizacao:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
