'use client';

import { ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function Providers({ children }: { children: ReactNode }) {
  const inicializar = useAuthStore((s) => s.inicializar);

  useEffect(() => {
    inicializar();
  }, [inicializar]);

  return <>{children}</>;
}
