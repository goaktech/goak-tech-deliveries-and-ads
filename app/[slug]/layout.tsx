import { createClient } from '@/utils/supabase/server';
import { PixelFacebookScript } from '@/components/ecommerce/PixelFacebookScript';

interface LojaLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function LojaLayout({ children, params }: LojaLayoutProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurante } = await supabase
    .from('restaurantes')
    .select('meta_pixel_id')
    .eq('slug', slug.trim())
    .maybeSingle();

  return (
    <>
      <PixelFacebookScript pixelId={restaurante?.meta_pixel_id ?? null} />
      {children}
    </>
  );
}
