'use client';

import { ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { AppShell } from '@/components/layout/AppShell';
import { ToastViewport } from '@/components/common/ToastViewport';

export function Providers({ children }: { children: ReactNode }) {
  const inicializar = useAuthStore((s) => s.inicializar);

  useEffect(() => {
    inicializar();
  }, [inicializar]);

  return (
    <AppShell>
      {children}
      <ToastViewport />
    </AppShell>
  );
}
