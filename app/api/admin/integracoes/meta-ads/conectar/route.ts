import { NextResponse } from 'next/server';
import { gerarUrlAutorizacaoMetaAds } from '@/utils/meta-ads';
import { COOKIE_NONCE_META_ADS } from '@/utils/meta-ads-oauth';

export async function GET(request: Request) {
  try {
    const { authUrl, nonce } = await gerarUrlAutorizacaoMetaAds();
    const resposta = NextResponse.redirect(authUrl);
    // O nonce vai no state (assinado) e neste cookie: o callback só vale para quem iniciou o fluxo.
    resposta.cookies.set(COOKIE_NONCE_META_ADS, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/admin/integracoes/meta-ads',
      maxAge: 15 * 60,
    });
    return resposta;
  } catch (error) {
    console.error('[meta-ads] Falha ao iniciar conexão:', error);
    return NextResponse.redirect(new URL('/admin/integracoes?status=meta-ads-erro&motivo=erro', request.url));
  }
}
