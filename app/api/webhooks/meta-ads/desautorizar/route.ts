import { NextResponse } from 'next/server';
import { removerDadosDoUsuarioMetaAds, validarSignedRequestMetaAds } from '@/utils/meta-ads';

// "Deauthorize Callback URL" do app Meta: chamado quando o usuário remove o app nas
// configurações do Facebook. Apagamos o token e os dados da conta de anúncios dele.
export async function POST(request: Request) {
  try {
    const formulario = await request.formData();
    const signedRequest = String(formulario.get('signed_request') ?? '');
    const { user_id: userId } = validarSignedRequestMetaAds(signedRequest);

    const removidas = await removerDadosDoUsuarioMetaAds(userId);
    console.info(`[meta-ads] Desautorização processada (${removidas} integração(ões) removida(s)).`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[meta-ads] Falha no callback de desautorização:', error);
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }
}
