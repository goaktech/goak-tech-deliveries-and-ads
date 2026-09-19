import { NextResponse } from 'next/server';
import { somenteDigitosCep, type EnderecoPorCep } from '@/utils/cep';

// Consulta de CEP feita pelo servidor (o navegador não chama o provedor direto:
// evita bloqueio por CORS/extensões e permite trocar de provedor sem mexer no app).
// Tenta o ViaCEP e, se ele não responder ou não achar, o BrasilAPI.

type ResultadoConsulta =
  | { status: 'ok'; endereco: EnderecoPorCep }
  | { status: 'nao_encontrado' }
  | { status: 'indisponivel' };

const TIMEOUT_MS = 5000;
const CACHE_SEGUNDOS = 60 * 60 * 24;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

async function consultarViaCep(cep: string): Promise<ResultadoConsulta> {
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: CACHE_SEGUNDOS },
    });
    // o ViaCEP responde 400 para CEP mal formatado e 200 + {"erro": true} para CEP inexistente
    if (resposta.status === 400) return { status: 'nao_encontrado' };
    if (!resposta.ok) return { status: 'indisponivel' };

    const dados = await resposta.json();
    if (dados?.erro) return { status: 'nao_encontrado' };

    return {
      status: 'ok',
      endereco: {
        cep,
        rua: texto(dados?.logradouro),
        bairro: texto(dados?.bairro),
        cidade: texto(dados?.localidade),
        uf: texto(dados?.uf),
      },
    };
  } catch (error) {
    console.error('Falha ao consultar ViaCEP:', error);
    return { status: 'indisponivel' };
  }
}

async function consultarBrasilApi(cep: string): Promise<ResultadoConsulta> {
  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: CACHE_SEGUNDOS },
    });
    if (resposta.status === 404 || resposta.status === 400) return { status: 'nao_encontrado' };
    if (!resposta.ok) return { status: 'indisponivel' };

    const dados = await resposta.json();
    return {
      status: 'ok',
      endereco: {
        cep,
        rua: texto(dados?.street),
        bairro: texto(dados?.neighborhood),
        cidade: texto(dados?.city),
        uf: texto(dados?.state),
      },
    };
  } catch (error) {
    console.error('Falha ao consultar BrasilAPI:', error);
    return { status: 'indisponivel' };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cep = somenteDigitosCep(searchParams.get('cep'));

  if (cep.length !== 8) {
    return NextResponse.json({ error: 'CEP inválido.' }, { status: 400 });
  }

  const viaCep = await consultarViaCep(cep);
  if (viaCep.status === 'ok') {
    return NextResponse.json(viaCep.endereco, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  }

  const brasilApi = await consultarBrasilApi(cep);
  if (brasilApi.status === 'ok') {
    return NextResponse.json(brasilApi.endereco, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  }

  if (viaCep.status === 'nao_encontrado' || brasilApi.status === 'nao_encontrado') {
    return NextResponse.json({ error: 'CEP não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ error: 'Serviço de CEP indisponível no momento.' }, { status: 502 });
}
