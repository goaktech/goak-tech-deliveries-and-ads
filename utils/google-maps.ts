
const GEOCODING_API_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
const ROUTES_API_BASE = 'https://routes.googleapis.com/directions/v2:computeRoutes';

export interface CoordenadaGeografica {
  latitude: number;
  longitude: number;
}

export interface ResultadoRota {
  distanciaKm: number;
  duracaoMinutos: number;
}

export interface EnderecoIdentificado {
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  formatado: string | null;
}

interface ComponenteEnderecoGoogle {
  long_name: string;
  short_name: string;
  types: string[];
}

function obterChaveGoogleMaps(): string | null {
  const chave = process.env.GOOGLE_MAPS_API_KEY;
  return chave && chave.trim().length > 0 ? chave.trim() : null;
}

export async function geocodificarEndereco(enderecoTexto: string): Promise<CoordenadaGeografica | null> {
  const chave = obterChaveGoogleMaps();
  const enderecoLimpo = enderecoTexto.trim();

  if (!chave || !enderecoLimpo) {
    return null;
  }

  try {
    const url = `${GEOCODING_API_BASE}?address=${encodeURIComponent(enderecoLimpo)}&region=br&key=${chave}`;
    const resposta = await fetch(url);

    if (!resposta.ok) {
      console.error('Falha HTTP na Geocoding API:', resposta.status);
      return null;
    }

    const payload = await resposta.json();

    if (payload.status !== 'OK' || !Array.isArray(payload.results) || payload.results.length === 0) {
      console.error('Geocoding API não retornou resultado utilizável:', payload.status, payload.error_message);
      return null;
    }

    const localizacao = payload.results[0]?.geometry?.location;
    if (typeof localizacao?.lat !== 'number' || typeof localizacao?.lng !== 'number') {
      return null;
    }

    return { latitude: localizacao.lat, longitude: localizacao.lng };
  } catch (error) {
    console.error('Erro ao geocodificar endereço:', error);
    return null;
  }
}

export async function calcularRotaEntrega(
  origem: CoordenadaGeografica,
  destino: CoordenadaGeografica
): Promise<ResultadoRota | null> {
  const chave = obterChaveGoogleMaps();
  if (!chave) {
    return null;
  }

  try {
    const resposta = await fetch(ROUTES_API_BASE, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': chave,
        'x-goog-fieldmask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origem.latitude, longitude: origem.longitude } } },
        destination: { location: { latLng: { latitude: destino.latitude, longitude: destino.longitude } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        units: 'METRIC',
      }),
    });

    if (!resposta.ok) {
      const corpoErro = await resposta.text();
      console.error('Falha HTTP na Routes API:', resposta.status, corpoErro);
      return null;
    }

    const payload = await resposta.json();
    const rota = payload?.routes?.[0];

    if (!rota || typeof rota.distanceMeters !== 'number' || typeof rota.duration !== 'string') {
      console.error('Routes API não retornou rota utilizável:', payload);
      return null;
    }

    const duracaoSegundos = Number(rota.duration.replace('s', ''));
    if (!Number.isFinite(duracaoSegundos)) {
      return null;
    }

    return {
      distanciaKm: Math.round((rota.distanceMeters / 1000) * 10) / 10,
      duracaoMinutos: Math.round(duracaoSegundos / 60),
    };
  } catch (error) {
    console.error('Erro ao calcular rota de entrega:', error);
    return null;
  }
}

function extrairComponenteEndereco(
  componentes: ComponenteEnderecoGoogle[],
  ...tipos: string[]
): string | null {
  for (const tipo of tipos) {
    const encontrado = componentes.find((c) => c.types.includes(tipo));
    if (encontrado) {
      return encontrado.long_name;
    }
  }
  return null;
}

export async function geocodificarReverso(coordenada: CoordenadaGeografica): Promise<EnderecoIdentificado | null> {
  const chave = obterChaveGoogleMaps();
  if (!chave) {
    return null;
  }

  try {
    const url = `${GEOCODING_API_BASE}?latlng=${coordenada.latitude},${coordenada.longitude}&language=pt-BR&key=${chave}`;
    const resposta = await fetch(url);

    if (!resposta.ok) {
      console.error('Falha HTTP na Geocoding API (reverso):', resposta.status);
      return null;
    }

    const payload = await resposta.json();

    if (payload.status !== 'OK' || !Array.isArray(payload.results) || payload.results.length === 0) {
      console.error('Geocoding API (reverso) não retornou resultado utilizável:', payload.status, payload.error_message);
      return null;
    }

    const resultado = payload.results[0];
    const componentes = (resultado?.address_components ?? []) as ComponenteEnderecoGoogle[];

    return {
      rua: extrairComponenteEndereco(componentes, 'route'),
      numero: extrairComponenteEndereco(componentes, 'street_number'),
      bairro: extrairComponenteEndereco(componentes, 'sublocality_level_1', 'sublocality', 'neighborhood'),
      cidade: extrairComponenteEndereco(componentes, 'locality', 'administrative_area_level_2'),
      cep: extrairComponenteEndereco(componentes, 'postal_code'),
      formatado: typeof resultado?.formatted_address === 'string' ? resultado.formatted_address : null,
    };
  } catch (error) {
    console.error('Erro ao geocodificar reverso:', error);
    return null;
  }
}

export function montarEnderecoParaGeocodificacao(endereco: {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
}): string {
  return [endereco.rua, endereco.numero, endereco.bairro, endereco.cidade, endereco.cep]
    .map((parte) => String(parte ?? '').trim())
    .filter(Boolean)
    .join(', ');
}
