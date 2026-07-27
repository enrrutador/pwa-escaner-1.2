import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PERMISOS_POR_ROL, type Permiso, type RolUsuario } from '@/types';
import { setCurrentTenant } from '@/lib/db';

export interface UsuarioApi {
  id: string;
  correo: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt: number;
  lastLoginAt?: number;
  sessionExpiresAt?: number;
  superAdmin?: boolean;
  tenantId?: string;
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
  esSuperAdmin: () => boolean;
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
        const actual = get().usuario;
        if (actual?.correo) {
          try {
            const res = await fetch('/api/auth/validate', {
              method: 'POST',
              credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
              set({ usuario: null });
              set({ inicializado: true });
              return;
            }
            set({ usuario: data.usuario });
            if (data.usuario?.tenantId) setCurrentTenant(data.usuario.tenantId);
            set({ inicializado: true });
            return;
          } catch {
            // Sin conexion: mantener usuario en memoria (no validamos)
          }
        }
        set({ inicializado: true });
      },

      async login(correo, password, deviceId) {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ correo, password, deviceId }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            return { ok: false, error: data.error || 'Error al iniciar sesión' };
          }
          set({ usuario: data.usuario });
          if (data.usuario?.tenantId) setCurrentTenant(data.usuario.tenantId);
          return { ok: true };
        } catch (e: any) {
          return { ok: false, error: 'Sin conexión al servidor' };
        }
      },

      async logout() {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ correo: get().usuario?.correo || '' }),
          });
        } catch {}
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
      esSuperAdmin() {
        return get().usuario?.superAdmin === true;
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

// Cookie httpOnly no es accesible desde cliente; las APIs leen cookie automaticamente.
// adminHeaders queda deprecado pero lo dejamos como helper vacio por compat.
export function adminHeaders(_usuario: UsuarioApi | null): HeadersInit {
  return { 'Content-Type': 'application/json' };
}
