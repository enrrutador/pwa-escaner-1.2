// src/lib/db-usuarios.ts
// Repositorio de usuarios: CRUD + auth por PIN.

import { db } from './db';
import { uid, now, hashPin } from './utils';
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
  ): Promise<{ ok: boolean; usuario?: Usuario; error?: string }> {
    const usuario = await this.obtenerPorNombre(nombre);
    if (!usuario || !usuario.activo) return { ok: false, error: 'Usuario no encontrado' };
    const hash = await hashPin(pin);
    if (hash !== usuario.pinHash) return { ok: false, error: 'PIN incorrecto' };
    return { ok: true, usuario };
  },

  async hayUsuarios(): Promise<boolean> {
    return (await db.usuarios.count()) > 0;
  },
};
