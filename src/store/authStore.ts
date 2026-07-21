import { create } from 'zustand';
import { persist, type StateStorage } from 'zustand/middleware';
import type { Usuario, Permiso } from '@/types';
import { PERMISOS_POR_ROL } from '@/types';
import { dbUsuarios } from '@/lib/db-usuarios';
import { seedSiVacio } from '@/lib/seed';

interface AuthState {
  usuario: Usuario | null;
  inicializado: boolean;
  _hasHydrated: boolean;
  inicializar: () => Promise<void>;
  login: (nombre: string, pin: string, deviceId: string, password?: string) => Promise<{ ok: boolean; error?: string }>;
  esAdminPorNombre: (nombre: string) => Promise<boolean>;
  logout: () => Promise<void>;
  tienePermiso: (permiso: Permiso) => boolean;
  esAdmin: () => boolean;
  validarSesion: () => Promise<boolean>;
}

interface PersistedAuthState {
  usuario: Usuario | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usuario: null,
      inicializado: false,
      _hasHydrated: false,

      async inicializar() {
        await seedSiVacio();

        const actual = get().usuario;
        if (actual) {
          const fresco = await dbUsuarios.obtener(actual.id);
          if (fresco?.activo) {
            if (fresco.sessionToken && fresco.sessionExpiresAt) {
              const valida = await dbUsuarios.validarSesion(fresco.id, fresco.deviceId || '', fresco.sessionToken);
              if (!valida) {
                set({ usuario: null });
                return;
              }
            }
            set({ usuario: fresco });
          } else {
            set({ usuario: null });
          }
        }

        set({ inicializado: true });
      },

      async login(nombre, pin, deviceId, password) {
        const res = await dbUsuarios.verificarPin(nombre, pin, deviceId);
        if (!res.ok || !res.usuario) return { ok: false, error: res.error };

        // Si el usuario es admin, validar password extra
        if (res.usuario.rol === 'admin' && res.usuario.passwordHash) {
          if (!password) return { ok: false, error: 'Contraseña requerida para admin' };
          const pwdOk = await dbUsuarios.verificarPassword(nombre, password);
          if (!pwdOk) return { ok: false, error: 'Contraseña admin incorrecta' };
        }

        const { sessionToken } = await dbUsuarios.iniciarSesion(res.usuario.id, deviceId);
        const usuarioActualizado = { ...res.usuario, sessionToken };
        set({ usuario: usuarioActualizado });
        return { ok: true };
      },

      async esAdminPorNombre(nombre) {
        const u = await dbUsuarios.obtenerPorNombre(nombre);
        return u?.rol === 'admin' && !!u?.passwordHash;
      },

      async logout() {
        const actual = get().usuario;
        if (actual?.sessionToken) {
          await dbUsuarios.cerrarSesion(actual.id);
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

      async validarSesion() {
        const actual = get().usuario;
        if (!actual?.sessionToken) return true;
        
        const valida = await dbUsuarios.validarSesion(actual.id, actual.deviceId || '', actual.sessionToken);
        if (!valida) {
          await get().logout();
          return false;
        }
        return true;
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