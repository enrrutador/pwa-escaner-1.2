'use client';

import { ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

export function Providers({ children }: { children: ReactNode }) {
  // Initialize stores on client
  useAuthStore.getState().inicializar();

  return <>{children}</>;
}
