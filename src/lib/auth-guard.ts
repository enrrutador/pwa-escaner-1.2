import { dbUsuarios } from './db-usuarios';
import { PERMISOS_POR_ROL, type Permiso } from '@/types';

interface AuthContext {
  usuarioId: string;
  sessionToken: string;
  deviceId: string;
}

function getAuthContext(): AuthContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('stockmaster-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    if (!state?.usuario?.id || !state?.usuario?.sessionToken) return null;
    return {
      usuarioId: state.usuario.id,
      sessionToken: state.usuario.sessionToken,
      deviceId: state.usuario.deviceId || '',
    };
  } catch {
    return null;
  }
}

export async function checkAuth(permiso: Permiso): Promise<{ ok: boolean; error?: string }> {
  const ctx = getAuthContext();
  if (!ctx) return { ok: false, error: 'No hay sesión activa' };

  const valida = await dbUsuarios.validarSesion(ctx.usuarioId, ctx.deviceId, ctx.sessionToken);
  if (!valida) return { ok: false, error: 'Sesión expirada o inválida' };

  const usuario = await dbUsuarios.obtener(ctx.usuarioId);
  if (!usuario || !usuario.activo) return { ok: false, error: 'Usuario no encontrado o inactivo' };

  const permisos = PERMISOS_POR_ROL[usuario.rol];
  if (!permisos.includes(permiso)) return { ok: false, error: 'No tenés permiso para esta acción' };

  return { ok: true };
}

export async function checkAuthById(
  ctx: { usuarioId: string; sessionToken: string; deviceId: string },
  permiso: Permiso,
): Promise<{ ok: boolean; error?: string }> {
  const valida = await dbUsuarios.validarSesion(ctx.usuarioId, ctx.deviceId, ctx.sessionToken);
  if (!valida) return { ok: false, error: 'Sesión expirada o inválida' };

  const usuario = await dbUsuarios.obtener(ctx.usuarioId);
  if (!usuario || !usuario.activo) return { ok: false, error: 'Usuario no encontrado o inactivo' };

  const permisos = PERMISOS_POR_ROL[usuario.rol];
  if (!permisos.includes(permiso)) return { ok: false, error: 'No tenés permiso para esta acción' };

  return { ok: true };
}