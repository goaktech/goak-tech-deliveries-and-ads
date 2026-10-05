import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  type CotacaoIfood,
  cancelarEntregaIfood,
  chamarEntregadorIfood,
  cotarEntregaIfood,
  listarMotivosCancelamentoIfood,
  responderAlteracaoEnderecoIfood,
  validarCodigoColetaIfood,
} from '@/utils/ifood-entrega';

interface Params {
  params: Promise<{ pedidoId: string }>;
}

type Corpo =
  | { acao: 'cotar' }
  | { acao: 'chamar'; cotacao: CotacaoIfood }
  | { acao: 'motivos' }
  | { acao: 'cancelar'; codigo: string; descricao: string }
  | { acao: 'endereco'; aceitar: boolean }
  | { acao: 'coleta'; codigo: string };

// iFood Entrega a partir do card da cozinha — ver utils/ifood-entrega.ts.
export async function POST(request: Request, { params }: Params) {
  try {
    const { pedidoId } = await params;
    const corpo = (await request.json().catch(() => ({}))) as Corpo;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('perfis_admin')
      .select('restaurante_id')
      .eq('id', user.id)
      .maybeSingle();

    if (perfilError || !perfil?.restaurante_id) {
      return NextResponse.json({ error: 'Restaurante do gestor não localizado.' }, { status: 403 });
    }

    const restauranteId = perfil.restaurante_id as string;

    switch (corpo.acao) {
      case 'cotar':
        return NextResponse.json({ cotacao: await cotarEntregaIfood(restauranteId, pedidoId) });
      case 'chamar':
        if (!corpo.cotacao?.id) {
          return NextResponse.json({ error: 'Faça a cotação antes de chamar o entregador.' }, { status: 400 });
        }
        return NextResponse.json(await chamarEntregadorIfood(restauranteId, pedidoId, corpo.cotacao));
      case 'motivos':
        return NextResponse.json({ motivos: await listarMotivosCancelamentoIfood(restauranteId, pedidoId) });
      case 'cancelar':
        if (!corpo.codigo) {
          return NextResponse.json({ error: 'Escolha o motivo do cancelamento.' }, { status: 400 });
        }
        await cancelarEntregaIfood(restauranteId, pedidoId, corpo.codigo, corpo.descricao ?? '');
        return NextResponse.json({ success: true });
      case 'endereco':
        await responderAlteracaoEnderecoIfood(restauranteId, pedidoId, corpo.aceitar === true);
        return NextResponse.json({ success: true });
      case 'coleta':
        if (!corpo.codigo?.trim()) {
          return NextResponse.json({ error: 'Informe o código que o entregador mostrou.' }, { status: 400 });
        }
        return NextResponse.json({ valido: await validarCodigoColetaIfood(restauranteId, pedidoId, corpo.codigo) });
      default:
        return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
    }
  } catch (error) {
    console.error('Erro na entrega iFood do pedido:', error);
    const mensagem = error instanceof Error ? error.message : 'Erro interno na entrega pelo iFood.';
    return NextResponse.json({ error: mensagem }, { status: 422 });
  }
}
