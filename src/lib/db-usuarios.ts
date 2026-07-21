// src/lib/db-usuarios.ts
// Repositorio de usuarios: CRUD + auth por PIN.

import { db } from './db';
import { uid, now, hashPin, hashPassword } from './utils';
import type { Usuario, RolUsuario } from '@/types';

export const dbUsuarios = {
  listar(): Promise<Usuario[]> {
    return db.usuarios.filter((u) => u.activo).sortBy('nombre');
  },

  obtener(id: string): Promise<Usuario | undefined> {
    return db.usuarios.get(id);
  },

  obtenerPorNombre(nombre: string): Promise<Usuario | undefined> {
    return db.usuarios.where('nombre').equals(nombre).first();
  },

  async crear({
    nombre,
    pin,
    rol,
  }: {
    nombre: string;
    pin: string;
    rol: RolUsuario;
  }): Promise<Usuario> {
    const usuario: Usuario = {
      id: uid(),
      nombre,
      pinHash: await hashPin(pin),
      rol,
      activo: true,
      createdAt: now(),
    };
    await db.usuarios.add(usuario);
    return usuario;
  },

  // Crear admin: con PIN + contraseña fuerte
  async crearAdmin({
    nombre,
    pin,
    password,
  }: {
    nombre: string;
    pin: string;
    password: string;
  }): Promise<Usuario> {
    if (password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }
    const usuario: Usuario = {
      id: uid(),
      nombre,
      pinHash: await hashPin(pin),
      passwordHash: await hashPassword(password),
      rol: 'admin',
      activo: true,
      createdAt: now(),
    };
    await db.usuarios.add(usuario);
    return usuario;
  },

  // Verificar contraseña admin (solo si usuario tiene passwordHash)
  async verificarPassword(nombre: string, password: string): Promise<boolean> {
    const usuario = await this.obtenerPorNombre(nombre);
    if (!usuario || !usuario.activo) return false;
    if (!usuario.passwordHash) return false;
    const h = await hashPassword(password);
    return h === usuario.passwordHash;
  },

  // Actualizar contraseña admin (solo admin puede invocar)
  async actualizarPassword(id: string, password: string): Promise<void> {
    if (password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }
    await db.usuarios.update(id, { passwordHash: await hashPassword(password) });
  },

  async actualizar(
    id: string,
    data: Partial<Usuario> & { pin?: string },
  ): Promise<void> {
    const { pin, ...rest } = data;
    const patch: Partial<Usuario> = { ...rest };
    if (pin) patch.pinHash = await hashPin(pin);
    await db.usuarios.update(id, patch);
  },

  async eliminar(id: string): Promise<void> {
    await db.usuarios.update(id, { activo: false });
  },

  async verificarPin(
    nombre: string,
    pin: string,
    deviceId?: string,
  ): Promise<{ ok: boolean; usuario?: Usuario; error?: string }> {
    const usuario = await this.obtenerPorNombre(nombre);
    if (!usuario || !usuario.activo) return { ok: false, error: 'Usuario no encontrado' };
    const hash = await hashPin(pin);
    if (hash !== usuario.pinHash) return { ok: false, error: 'PIN incorrecto' };
    
    // Verificar dispositivo único
    if (deviceId) {
      if (usuario.deviceId && usuario.deviceId !== deviceId) {
        return { ok: false, error: 'Este usuario ya está registrado en otro dispositivo' };
      }
      // Verificar sesión activa
      if (usuario.sessionExpiresAt && usuario.sessionExpiresAt > Date.now()) {
        if (usuario.deviceId && usuario.deviceId !== deviceId) {
          return { ok: false, error: 'Sesión activa en otro dispositivo' };
        }
      }
    }
    
    return { ok: true, usuario };
  },

  async hayUsuarios(): Promise<boolean> {
    return (await db.usuarios.count()) > 0;
  },

  // Iniciar sesión: registrar dispositivo y crear token de sesión
  async iniciarSesion(
    usuarioId: string,
    deviceId: string,
    duracionDias: number = 30,
  ): Promise<{ sessionToken: string; expiraEn: number }> {
    const sessionToken = 'st_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiraEn = Date.now() + duracionDias * 24 * 60 * 60 * 1000;
    await db.usuarios.update(usuarioId, {
      deviceId,
      sessionToken,
      lastLoginAt: Date.now(),
      sessionExpiresAt: expiraEn,
    });
    return { sessionToken, expiraEn };
  },

  // Cerrar sesión (limpiar token pero mantener deviceId para re-login rápido)
  async cerrarSesion(usuarioId: string): Promise<void> {
    await db.usuarios.update(usuarioId, {
      sessionToken: undefined,
      sessionExpiresAt: undefined,
    });
  },

  // Revocar acceso (admin): limpiar todo, desactivar usuario
  async revocarAcceso(usuarioId: string): Promise<void> {
    await db.usuarios.update(usuarioId, {
      activo: false,
      deviceId: undefined,
      sessionToken: undefined,
      sessionExpiresAt: undefined,
    });
  },

  // Verificar si sesión es válida
  async validarSesion(usuarioId: string, deviceId: string, sessionToken: string): Promise<boolean> {
    const usuario = await this.obtener(usuarioId);
    if (!usuario || !usuario.activo) return false;
    if (usuario.sessionToken !== sessionToken) return false;
    if (usuario.deviceId !== deviceId) return false;
    if (usuario.sessionExpiresAt && usuario.sessionExpiresAt < Date.now()) return false;
    return true;
  },

  // Admin: extender sesión
  async extenderSesion(usuarioId: string, diasExtra: number): Promise<void> {
    const usuario = await this.obtener(usuarioId);
    if (!usuario) throw new Error('Usuario no encontrado');
    const nuevaExpiracion = (usuario.sessionExpiresAt || Date.now()) + diasExtra * 24 * 60 * 60 * 1000;
    await db.usuarios.update(usuarioId, { sessionExpiresAt: nuevaExpiracion });
  },
};