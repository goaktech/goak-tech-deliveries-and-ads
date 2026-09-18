import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createWebhookAdminClient } from '@/utils/supabase/webhook';

const BUCKET_FOTOS_CAPA =
  process.env.SUPABASE_PRODUTOS_BUCKET ??
  process.env.SUPABASE_CARDAPIO_BUCKET ??
  'produtos';
const TAMANHO_MAXIMO_FOTO_CAPA_BYTES = 7 * 1024 * 1024;

const EXTENSOES_PERMITIDAS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
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
    const arquivoFotoCapa = formData.get('fotoCapa');

    if (!(arquivoFotoCapa instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de foto de capa inválido.' }, { status: 400 });
    }

    if (!EXTENSOES_PERMITIDAS[arquivoFotoCapa.type]) {
      return NextResponse.json({ error: 'Formato inválido. Use PNG, JPG ou WEBP.' }, { status: 400 });
    }

    if (arquivoFotoCapa.size > TAMANHO_MAXIMO_FOTO_CAPA_BYTES) {
      return NextResponse.json({ error: 'A foto de capa deve ter no máximo 7MB.' }, { status: 400 });
    }

    const extensao = EXTENSOES_PERMITIDAS[arquivoFotoCapa.type];
    const caminhoFotoCapa = `restaurantes/${perfil.restaurante_id}/capa.${extensao}`;
    const buffer = Buffer.from(await arquivoFotoCapa.arrayBuffer());

    const supabaseAdmin = createWebhookAdminClient();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_FOTOS_CAPA)
      .upload(caminhoFotoCapa, buffer, {
        contentType: arquivoFotoCapa.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Falha no upload da foto de capa: ${uploadError.message}` }, { status: 500 });
    }

    const { data: fotoCapaPublica } = supabaseAdmin.storage.from(BUCKET_FOTOS_CAPA).getPublicUrl(caminhoFotoCapa);

    const fotoCapaUrlComVersao = `${fotoCapaPublica.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabaseAdmin
      .from('restaurantes')
      .update({ foto_capa_url: fotoCapaUrlComVersao })
      .eq('id', perfil.restaurante_id);

    if (updateError) {
      return NextResponse.json({ error: `Falha ao salvar URL da foto de capa: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ foto_capa_url: fotoCapaUrlComVersao });
  } catch (error) {
    console.error('Erro ao atualizar foto de capa do restaurante:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar foto de capa.' }, { status: 500 });
  }
}

export async function DELETE() {
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

    const supabaseAdmin = createWebhookAdminClient();
    const { error: updateError } = await supabaseAdmin
      .from('restaurantes')
      .update({ foto_capa_url: null })
      .eq('id', perfil.restaurante_id);

    if (updateError) {
      return NextResponse.json({ error: `Falha ao remover foto de capa: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ foto_capa_url: null });
  } catch (error) {
    console.error('Erro ao remover foto de capa do restaurante:', error);
    return NextResponse.json({ error: 'Erro interno ao remover foto de capa.' }, { status: 500 });
  }
}
