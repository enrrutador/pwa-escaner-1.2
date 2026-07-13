// src/lib/db-ubicaciones.ts
// Repositorio de ubicaciones: CRUD + árbol jerárquico + ruta.

import { db } from './db';
import { uid, now } from './utils';
import type { Ubicacion, UbicacionConHijos } from '@/types';

export const dbUbicaciones = {
  listar(): Promise<Ubicacion[]> {
    return db.ubicaciones.filter((u) => u.activo).sortBy('nombre');
  },

  obtener(id: string): Promise<Ubicacion | undefined> {
    return db.ubicaciones.get(id);
  },

  hijos(parentId: string | null = null): Promise<Ubicacion[]> {
    return db.ubicaciones
      .where('parentId')
      .equals(parentId as any)
      .filter((u) => u.activo)
      .sortBy('nombre');
  },

  async crear(
    data: Omit<Ubicacion, 'id' | 'createdAt' | 'activo'> & Partial<Pick<Ubicacion, 'activo'>>,
  ): Promise<Ubicacion> {
    const ubicacion: Ubicacion = {
      id: uid(),
      activo: true,
      createdAt: now(),
      ...data,
    };
    await db.ubicaciones.add(ubicacion);
    return ubicacion;
  },

  async actualizar(id: string, data: Partial<Ubicacion>): Promise<void> {
    await db.ubicaciones.update(id, data);
  },

  async eliminar(id: string): Promise<void> {
    await db.ubicaciones.update(id, { activo: false });
  },

  async construirArbol(): Promise<UbicacionConHijos[]> {
    const todas = await this.listar();
    const mapa = new Map<string, UbicacionConHijos>();
    todas.forEach((u) => mapa.set(u.id, { ...u, hijos: [] }));

    const raiz: UbicacionConHijos[] = [];
    mapa.forEach((nodo) => {
      if (nodo.parentId && mapa.has(nodo.parentId)) {
        mapa.get(nodo.parentId)!.hijos.push(nodo);
      } else {
        raiz.push(nodo);
      }
    });
    return raiz;
  },

  async obtenerRuta(id: string): Promise<Ubicacion[]> {
    const ruta: Ubicacion[] = [];
    let actual = await db.ubicaciones.get(id);
    while (actual) {
      ruta.unshift(actual);
      actual = actual.parentId ? await db.ubicaciones.get(actual.parentId) : undefined;
    }
    return ruta;
  },

  async limpiarTodo(): Promise<void> {
    await db.ubicaciones.clear();
  },
};
