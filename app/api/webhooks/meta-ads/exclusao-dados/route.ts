import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { removerDadosDoUsuarioMetaAds, validarSignedRequestMetaAds } from '@/utils/meta-ads';

export async function POST(request: Request) {
  try {
    const formulario = await request.formData();
    const signedRequest = String(formulario.get('signed_request') ?? '');
    const { user_id: userId } = validarSignedRequestMetaAds(signedRequest);

    await removerDadosDoUsuarioMetaAds(userId);

    const codigo = crypto.randomUUID();
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/$/, '');
    return NextResponse.json({
      url: `${baseUrl}/meta-ads-exclusao-dados?codigo=${codigo}`,
      confirmation_code: codigo,
    });
  } catch (error) {
    console.error('[meta-ads] Falha no callback de exclusão de dados:', error);
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }
}
