import { NextResponse } from 'next/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';
import { geocodificarEndereco, montarEnderecoParaGeocodificacao } from '@/utils/google-maps';
import { cotarTaxaEntregaIfoodCheckout } from '@/utils/ifood-entrega';

interface Params {
  params: Promise<{ slug: string }>;
}

interface Corpo {
  latitude?: number;
  longitude?: number;
  endereco?: { rua?: string; numero?: string; bairro?: string; cidade?: string; cep?: string };
}

// Taxa de entrega do iFood para a tela do checkout (lojas com "Entregas pelo
// iFood"). Só exibição: o valor cobrado é recalculado em POST /api/checkout.
export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const corpo = (await request.json().catch(() => ({}))) as Corpo;

    const { data: restaurante } = await createWebhookAdminClient()
      .from('restaurantes')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!restaurante) {
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 });
    }

    let coordenada =
      typeof corpo.latitude === 'number' && typeof corpo.longitude === 'number'
        ? { latitude: corpo.latitude, longitude: corpo.longitude }
        : null;
    if (!coordenada && corpo.endereco) {
      const texto = montarEnderecoParaGeocodificacao(corpo.endereco);
      coordenada = texto ? await geocodificarEndereco(texto) : null;
    }
    if (!coordenada) {
      return NextResponse.json({ disponivel: false, motivo: 'endereco' });
    }

    const taxa = await cotarTaxaEntregaIfoodCheckout(restaurante.id, coordenada);
    if (!taxa) {
      return NextResponse.json({ disponivel: false, motivo: 'indisponivel' });
    }

    return NextResponse.json({
      disponivel: true,
      taxa: taxa.taxaCliente,
      tempoMinimoMin: taxa.cotacao.tempoMinimoMin,
      tempoMaximoMin: taxa.cotacao.tempoMaximoMin,
    });
  } catch (error) {
    console.error('Erro ao cotar entrega iFood para o checkout:', error);
    return NextResponse.json({ disponivel: false, motivo: 'erro' });
  }
}
