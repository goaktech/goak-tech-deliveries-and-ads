'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AdminNavHeader, BarraNavegacaoMobile } from '@/components/admin/AdminNavHeader';
import { AvisosPainelProvider } from '@/components/shared/AvisosPainel';
import type { RestauranteCabecalhoAdmin } from '@/utils/admin-auth';

/**
 * Moldura única do painel: o cabeçalho com as abas fica aqui, fora das páginas, e por isso não é
 * recriado nem recarregado a cada troca de aba. Só o conteúdo abaixo dele muda.
 */
export function CascaAdmin({
  restaurante,
  children,
}: {
  restaurante: RestauranteCabecalhoAdmin | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const ehCozinha = pathname === '/admin/cozinha' || pathname?.startsWith('/admin/cozinha/');

  // No celular a barra de navegação fica fixa no rodapé; o espaço extra evita que ela cubra o fim da página.
  return (
    <AvisosPainelProvider>
      <div
        className={`flex min-h-screen items-start justify-center bg-[#F3F3F3] p-4 pb-28 font-sans text-[#1A1A1A] antialiased sm:p-8 sm:pb-28 md:py-12 ${
          ehCozinha ? 'md:pb-24' : ''
        }`}
      >
        <div className="w-full min-w-0 max-w-5xl space-y-6">
          <AdminNavHeader restaurante={restaurante} />
          {children}
        </div>
      </div>
      <BarraNavegacaoMobile />
    </AvisosPainelProvider>
  );
}
