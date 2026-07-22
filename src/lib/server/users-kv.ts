// src/lib/server/users-kv.ts
// Repositorio de usuarios en Upstash Redis.
// Estructura:
//   user:{correo} -> JSON del usuario (passwordHash, rol, deviceId, sessionToken, ...)
//   index:users   -> set de correos para listado rápido

import { Redis } from '@upstash/redis';
import { hashPassword, uid } from '@/lib/utils';

export interface UsuarioKv {
  id: string;
  correo: string;
  nombre: string;
  passwordHash: string;
  rol: 'admin' | 'operador' | 'viewer';
  activo: boolean;
  createdAt: number;
  deviceId?: string;
  sessionToken?: string;
  lastLoginAt?: number;
  sessionExpiresAt?: number;
}

const PWD_MIN = 8;

function kv(): Redis {
  // Vercel inyecta KV_REST_API_URL y KV_REST_API_TOKEN automaticamente
  // cuando se conecta Upstash como KV store
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('KV_REST_API_URL/TOKEN no configuradas (¿Upstash conectado al proyecto?)');
  }
  return new Redis({ url, token });
}

const key = (correo: string) => `user:${correo.toLowerCase()}`;
const INDEX_KEY = 'index:users';

export const usersKv = {
  async listar(): Promise<UsuarioKv[]> {
    const r = kv();
    const correos = (await r.smembers(INDEX_KEY)) as string[];
    if (!correos.length) return [];
    const users = (await r.mget(...correos.map(key))) as unknown as UsuarioKv[];
    return users.filter(Boolean);
  },

  async obtener(correo: string): Promise<UsuarioKv | null> {
    const r = kv();
    const u = await r.get<UsuarioKv>(key(correo));
    return u || null;
  },

  async crear({
    correo,
    nombre,
    password,
    rol,
  }: {
    correo: string;
    nombre: string;
    password: string;
    rol: UsuarioKv['rol'];
  }): Promise<UsuarioKv> {
    if (password.length < PWD_MIN) {
      throw new Error(`La contraseña debe tener al menos ${PWD_MIN} caracteres`);
    }
    const r = kv();
    const existe = await r.get(key(correo));
    if (existe) throw new Error('Ya existe un usuario con ese correo');

    const usuario: UsuarioKv = {
      id: uid(),
      correo: correo.toLowerCase(),
      nombre,
      passwordHash: await hashPassword(password),
      rol,
      activo: true,
      createdAt: Date.now(),
    };
    await r.set(key(correo), usuario);
    await r.sadd(INDEX_KEY, correo.toLowerCase());
    return usuario;
  },

  async actualizarPassword(correo: string, password: string): Promise<void> {
    if (password.length < PWD_MIN) {
      throw new Error(`La contraseña debe tener al menos ${PWD_MIN} caracteres`);
    }
    const r = kv();
    const u = await r.get<UsuarioKv>(key(correo));
    if (!u) throw new Error('Usuario no encontrado');
    u.passwordHash = await hashPassword(password);
    await r.set(key(correo), u);
  },

  async verificarPassword(
    correo: string,
    password: string,
    deviceId?: string,
  ): Promise<{ ok: boolean; usuario?: UsuarioKv; error?: string }> {
    const u = await this.obtener(correo);
    if (!u || !u.activo) return { ok: false, error: 'Usuario no encontrado' };

    const hash = await hashPassword(password);
    if (hash !== u.passwordHash) return { ok: false, error: 'Contraseña incorrecta' };

    if (deviceId) {
      if (u.deviceId && u.deviceId !== deviceId) {
        return { ok: false, error: 'Este usuario ya está registrado en otro dispositivo' };
      }
      if (u.sessionExpiresAt && u.sessionExpiresAt > Date.now()) {
        if (u.deviceId && u.deviceId !== deviceId) {
          return { ok: false, error: 'Sesión activa en otro dispositivo' };
        }
      }
    }

    return { ok: true, usuario: u };
  },

  async iniciarSesion(
    correo: string,
    deviceId: string,
    duracionDias: number = 30,
  ): Promise<{ sessionToken: string; expiraEn: number; usuario: UsuarioKv }> {
    const r = kv();
    const u = await r.get<UsuarioKv>(key(correo));
    if (!u) throw new Error('Usuario no encontrado');

    const sessionToken = 'st_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiraEn = Date.now() + duracionDias * 24 * 60 * 60 * 1000;
    u.deviceId = deviceId;
    u.sessionToken = sessionToken;
    u.lastLoginAt = Date.now();
    u.sessionExpiresAt = expiraEn;
    await r.set(key(correo), u);
    return { sessionToken, expiraEn, usuario: u };
  },

  async cerrarSesion(correo: string): Promise<void> {
    const r = kv();
    const u = await r.get<UsuarioKv>(key(correo));
    if (!u) return;
    u.sessionToken = undefined;
    u.sessionExpiresAt = undefined;
    await r.set(key(correo), u);
  },

  async validarSesion(correo: string, deviceId: string, sessionToken: string): Promise<boolean> {
    const u = await this.obtener(correo);
    if (!u || !u.activo) return false;
    if (u.sessionToken !== sessionToken) return false;
    if (u.deviceId !== deviceId) return false;
    if (u.sessionExpiresAt && u.sessionExpiresAt < Date.now()) return false;
    return true;
  },

  async validarSesionPorDispositivo(correo: string, deviceId: string): Promise<UsuarioKv | null> {
    const u = await this.obtener(correo);
    if (!u || !u.activo) return null;
    if (!u.sessionToken || !u.sessionExpiresAt) return null;
    if (u.sessionExpiresAt < Date.now()) return null;
    if (u.deviceId !== deviceId) return null;
    return u;
  },

  // Admin: desvincular dispositivo de un usuario (para que pueda loguear en otro)
  async limpiarDispositivo(correo: string): Promise<void> {
    const r = kv();
    const u = await r.get<UsuarioKv>(key(correo));
    if (!u) throw new Error('Usuario no encontrado');
    u.deviceId = undefined;
    u.sessionToken = undefined;
    u.sessionExpiresAt = undefined;
    await r.set(key(correo), u);
  },
};
