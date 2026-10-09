import type { ReactNode } from 'react';
import { CascaAdmin } from '@/components/admin/CascaAdmin';
import { obterRestauranteCabecalhoAdmin } from '@/utils/admin-auth';

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const restaurante = await obterRestauranteCabecalhoAdmin();

  return <CascaAdmin restaurante={restaurante}>{children}</CascaAdmin>;
}
