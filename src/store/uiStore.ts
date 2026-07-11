// src/store/uiStore.ts
'use client';

import { create } from 'zustand';
import { uid } from '@/lib/utils';

export type TipoToast = 'exito' | 'error' | 'info' | 'advertencia';

export interface Toast {
  id: string;
  tipo: TipoToast;
  mensaje: string;
}

interface UIState {
  toasts: Toast[];
  mostrarToast: (tipo: TipoToast, mensaje: string) => void;
  quitarToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],

  mostrarToast(tipo, mensaje) {
    const id = uid();
    set({ toasts: [...get().toasts, { id, tipo, mensaje }] });
    setTimeout(() => get().quitarToast(id), 3200);
  },

  quitarToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));
