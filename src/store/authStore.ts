import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PERMISOS_POR_ROL, type Permiso, type RolUsuario } from '@/types';

export interface UsuarioApi {
  id: string;
  correo: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt: number;
  deviceId?: string;
  sessionToken?: string;
  lastLoginAt?: number;
  sessionExpiresAt?: number;
}

interface AuthState {
  usuario: UsuarioApi | null;
  inicializado: boolean;
  _hasHydrated: boolean;
  inicializar: () => Promise<void>;
  login: (correo: string, password: string, deviceId: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  tienePermiso: (permiso: Permiso) => boolean;
  esAdmin: () => boolean;
}

interface PersistedAuthState {
  usuario: UsuarioApi | null;
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let deviceId = localStorage.getItem('stockmaster-device-id');
  if (!deviceId) {
    deviceId = uid();
    localStorage.setItem('stockmaster-device-id', deviceId);
  }
  return deviceId;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usuario: null,
      inicializado: false,
      _hasHydrated: false,

      async inicializar() {
        // Asegurar que el admin Marcelo exista en el backend (seed)
        try {
          await fetch('/api/auth/seed', { method: 'POST' });
        } catch {}

        // Si hay usuario persistido, validar sesión contra el backend
        const actual = get().usuario;
        if (actual?.sessionToken && actual?.correo) {
          try {
            const res = await fetch('/api/auth/validate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                correo: actual.correo,
                deviceId: getDeviceId(),
                sessionToken: actual.sessionToken,
              }),
            });
            const data = await res.json();
            if (!data.ok) {
              set({ usuario: null });
              set({ inicializado: true });
              return;
            }
            // Refrescar datos por si cambiaron
            set({ usuario: data.usuario });
          } catch {
            // Sin conexión: mantener usuario persistido (offline-first para sesión ya abierta)
          }
        }
        set({ inicializado: true });
      },

      async login(correo, password, deviceId) {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, password, deviceId }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            return { ok: false, error: data.error || 'Error al iniciar sesión' };
          }
          set({ usuario: data.usuario });
          return { ok: true };
        } catch (e: any) {
          return { ok: false, error: 'Sin conexión al servidor' };
        }
      },

      async logout() {
        const actual = get().usuario;
        if (actual?.correo) {
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ correo: actual.correo }),
            });
          } catch {}
        }
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
      partialize: (state): PersistedAuthState => ({ usuario: state.usuario }),
      onRehydrateStorage: () => (state) => {
        if (state) state._hasHydrated = true;
      },
    }
  )
);

// Helper para headers de autorización admin
export function adminHeaders(usuario: UsuarioApi | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-user-correo': usuario?.correo || '',
    'x-user-token': usuario?.sessionToken || '',
    'x-user-device': getDeviceId(),
  };
}
