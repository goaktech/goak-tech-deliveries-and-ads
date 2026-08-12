import type { MetadataRoute } from 'next';
import { APP_BRAND_NAME } from '@/utils/branding';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_BRAND_NAME} Pedidos`,
    short_name: APP_BRAND_NAME,
    description: 'Acompanhe o status do seu pedido em tempo real.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8F8F8',
    theme_color: '#E16349',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
