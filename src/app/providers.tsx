'use client';

import { ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { AppShell } from '@/components/layout/AppShell';

export function Providers({ children }: { children: ReactNode }) {
  const inicializar = useAuthStore((s) => s.inicializar);

  useEffect(() => {
    inicializar();
  }, [inicializar]);

  return (
    <AppShell>
      {children}
    </AppShell>
  );
}
