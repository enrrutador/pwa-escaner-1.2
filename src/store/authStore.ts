// src/store/authStore.ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Usuario, Permiso } from '@/types';
import { PERMISOS_POR_ROL } from '@/types';
import { dbUsuarios } from '@/lib/db-usuarios';
import { seedSiVacio } from '@/lib/seed';

interface AuthState {
  usuario: Usuario | null;
  inicializado: boolean;
  inicializar: () => Promise<void>;
  login: (nombre: string, pin: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  tienePermiso: (permiso: Permiso) => boolean;
  esAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usuario: null,
      inicializado: false,

      async inicializar() {
        // Seed inicial si la DB está vacía
        await seedSiVacio();

        // Rehidrata usuario persistido validando que siga activo en DB.
        const actual = get().usuario;
        if (actual) {
          const fresco = await dbUsuarios.obtener(actual.id);
          set({ usuario: fresco?.activo ? fresco : null });
        }

        // Si no hay usuario logueado, auto-login como admin
        if (!get().usuario) {
          const admin = await dbUsuarios.obtenerPorNombre('Marcelo');
          if (admin?.activo) {
            set({ usuario: admin });
          }
        }

        set({ inicializado: true });
      },

      async login(nombre, pin) {
        const res = await dbUsuarios.verificarPin(nombre, pin);
        if (!res.ok || !res.usuario) return { ok: false, error: res.error };
        set({ usuario: res.usuario });
        return { ok: true };
      },

      logout() {
        set({ usuario: null });
      },

      tienePermiso(permiso) {
        const u = get().usuario;
        if (!u) return false;
        return PERMISOS_POR_ROL[u.rol].includes(permiso);
      },

      esAdmin() {
        return get().usuario?.rol === 'admin';
      },
    }),
    {
      name: 'stockmaster-auth',
      // Solo persistimos el usuario.
      partialize: (state) => ({ usuario: state.usuario }),
    },
  ),
);
