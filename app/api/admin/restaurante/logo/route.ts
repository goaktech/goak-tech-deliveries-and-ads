import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

const BUCKET_LOGOS =
  process.env.SUPABASE_PRODUTOS_BUCKET ??
  process.env.SUPABASE_CARDAPIO_BUCKET ??
  'produtos';
const TAMANHO_MAXIMO_LOGO_BYTES = 5 * 1024 * 1024;

const EXTENSOES_PERMITIDAS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export async function POST(request: Request) {
  try {
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
      return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 });
    }

    const formData = await request.formData();
    const arquivoLogo = formData.get('logo');

    if (!(arquivoLogo instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de logo inválido.' }, { status: 400 });
    }

    if (!EXTENSOES_PERMITIDAS[arquivoLogo.type]) {
      return NextResponse.json({ error: 'Formato inválido. Use PNG, JPG, WEBP ou SVG.' }, { status: 400 });
    }

    if (arquivoLogo.size > TAMANHO_MAXIMO_LOGO_BYTES) {
      return NextResponse.json({ error: 'A logo deve ter no máximo 5MB.' }, { status: 400 });
    }

    const extensao = EXTENSOES_PERMITIDAS[arquivoLogo.type];
    const caminhoLogo = `restaurantes/${perfil.restaurante_id}/logo.${extensao}`;
    const buffer = Buffer.from(await arquivoLogo.arrayBuffer());

    const supabaseAdmin = createWebhookAdminClient();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_LOGOS)
      .upload(caminhoLogo, buffer, {
        contentType: arquivoLogo.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Falha no upload da logo: ${uploadError.message}` }, { status: 500 });
    }

    const { data: logoPublica } = supabaseAdmin.storage.from(BUCKET_LOGOS).getPublicUrl(caminhoLogo);

    const logoUrlComVersao = `${logoPublica.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabaseAdmin
      .from('restaurantes')
      .update({ logo_url: logoUrlComVersao })
      .eq('id', perfil.restaurante_id);

    if (updateError) {
      return NextResponse.json({ error: `Falha ao salvar URL da logo: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ logo_url: logoUrlComVersao });
  } catch (error) {
    console.error('Erro ao atualizar logo do restaurante:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar logo.' }, { status: 500 });
  }
}
