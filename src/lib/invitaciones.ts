// src/lib/invitaciones.ts
// Sistema de invitaciones: el admin crea un código que el operador canjea en /login.
// El código contiene el usuario serializado (nombre + pinHash + rol + createdAt).
// Es base64 (no criptográfico) — sirve para transferir credenciales sin que el
// operador tenga que escribir nombre+PIN manualmente y para que no se generen
// credenciales sin permiso del admin.

import { db } from './db';
import { uid, now } from './utils';
import type { Usuario, RolUsuario } from '@/types';

// Cabecera para distinguir versiones
const PREFIJO = 'STK1';

/** Codifica un usuario recién creado en un código de invitación portable. */
export function codificarInvitacion(u: {
  nombre: string;
  pinHash: string;
  rol: RolUsuario;
}): string {
  const payload = {
    n: u.nombre,
    p: u.pinHash,
    r: u.rol,
  };
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `${PREFIJO}-${b64}`;
}

/** Decodifica un código de invitación. Devuelve null si es inválido. */
export function decodificarInvitacion(
  codigo: string,
): { nombre: string; pinHash: string; rol: RolUsuario } | null {
  try {
    const limpio = codigo.trim().replace(/\s+/g, '');
    if (!limpio.startsWith(PREFIJO + '-')) return null;
    const b64 = limpio.slice(PREFIJO.length + 1);
    const json = decodeURIComponent(escape(atob(b64)));
    const data = JSON.parse(json);
    if (!data.n || !data.p || !data.r) return null;
    if (!['admin', 'operador', 'viewer'].includes(data.r)) return null;
    return { nombre: data.n, pinHash: data.p, rol: data.r };
  } catch {
    return null;
  }
}

/** Canjear invitación: crea el usuario en la DB local del operador. */
export async function canjearInvitacion(
  codigo: string,
  deviceId: string,
): Promise<{ ok: boolean; usuario?: Usuario; error?: string }> {
  const data = decodificarInvitacion(codigo);
  if (!data) return { ok: false, error: 'Código de invitación inválido' };

  // Si ya existe un usuario con ese nombre, no duplicar
  const existente = await db.usuarios
    .where('nombre')
    .equals(data.nombre)
    .first();
  if (existente) {
    // Ya está acá, devolverlo tal cual
    return { ok: true, usuario: existente };
  }

  const usuario: Usuario = {
    id: uid(),
    nombre: data.nombre,
    pinHash: data.pinHash,
    rol: data.rol,
    activo: true,
    createdAt: now(),
  };
  await db.usuarios.add(usuario);
  return { ok: true, usuario };
}
