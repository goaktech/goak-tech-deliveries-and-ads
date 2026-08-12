import type { Metadata, Viewport } from 'next';
import { ProvedorCarrinho } from '@/components/ecommerce/ContextoCarrinho';
import { APP_BRAND_NAME } from '@/utils/branding';
import './globals.css';

export const metadata: Metadata = {
  title: `${APP_BRAND_NAME} | Plataforma de Vendas`,
  description: 'O seu delivery proprietário integrado à inteligência de dados.',
};

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased bg-[#F3F3F3]">
        <ProvedorCarrinho>
          {children}
        </ProvedorCarrinho>
      </body>
    </html>
  );
}
