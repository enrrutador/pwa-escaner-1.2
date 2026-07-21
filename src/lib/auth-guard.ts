// src/lib/auth-guard.ts
// Verifica permisos locales contra el usuario activo en zustand.
// La validación de sesión real contra el backend ocurre en authStore.inicializar.

import { PERMISOS_POR_ROL, type Permiso, type RolUsuario } from '@/types';

interface AuthContext {
  rol: RolUsuario;
  activo: boolean;
}

function getAuthContext(): AuthContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('stockmaster-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    if (!state?.usuario?.rol) return null;
    return {
      rol: state.usuario.rol,
      activo: state.usuario.activo !== false,
    };
  } catch {
    return null;
  }
}

export function checkAuth(permiso: Permiso): { ok: boolean; error?: string } {
  const ctx = getAuthContext();
  if (!ctx) return { ok: false, error: 'No hay sesión activa' };
  if (!ctx.activo) return { ok: false, error: 'Usuario inactivo' };

  const permisos = PERMISOS_POR_ROL[ctx.rol];
  if (!permisos.includes(permiso)) return { ok: false, error: 'No tenés permiso para esta acción' };

  return { ok: true };
}
