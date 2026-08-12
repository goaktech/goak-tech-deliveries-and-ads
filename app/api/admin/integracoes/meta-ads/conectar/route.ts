import { NextResponse } from 'next/server';
import { gerarUrlAutorizacaoMetaAds } from '@/utils/meta-ads';

export async function GET() {
  try {
    const { authUrl } = await gerarUrlAutorizacaoMetaAds();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao iniciar conexão com Meta Ads.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
