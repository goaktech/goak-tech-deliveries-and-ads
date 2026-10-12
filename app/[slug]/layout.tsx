import { obterPixelIdVitrineEmCache } from '@/utils/cache-vitrine';
import { ehVitrineAlternativa } from '@/utils/alias-vitrines';
import { PixelFacebookScript } from '@/components/ecommerce/PixelFacebookScript';

interface LojaLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function LojaLayout({ children, params }: LojaLayoutProps) {
  const { slug } = await params;
  const pixelId = ehVitrineAlternativa(slug) ? null : await obterPixelIdVitrineEmCache(slug.trim());

  return (
    <>
      <PixelFacebookScript pixelId={pixelId} />
      {children}
    </>
  );
}
