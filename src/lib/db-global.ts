// src/lib/db-global.ts
// Utilidades globales de BD: limpiar todo, exportar todo.

import { db } from './db';

export const dbGlobal = {
  async limpiarTodo(): Promise<void> {
    await db.transaction('rw', db.productos, db.ubicaciones, db.movimientos, db.usuarios, async () => {
      await Promise.all([
        db.productos.clear(),
        db.ubicaciones.clear(),
        db.movimientos.clear(),
        db.usuarios.clear(),
      ]);
    });
    await db.transaction('rw', db.conteos, db.conteoItems, db.alertas, db.escaneos, async () => {
      await Promise.all([
        db.conteos.clear(),
        db.conteoItems.clear(),
        db.alertas.clear(),
        db.escaneos.clear(),
      ]);
    });
  },

  async exportarTodo() {
    const [
      productos,
      ubicaciones,
      movimientos,
      usuarios,
      conteos,
      alertas,
      escaneos,
    ] = await Promise.all([
      db.productos.toArray(),
      db.ubicaciones.toArray(),
      db.movimientos.toArray(),
      db.usuarios.toArray(),
      db.conteos.toArray(),
      db.alertas.toArray(),
      db.escaneos.toArray(),
    ]);
    return { productos, ubicaciones, movimientos, usuarios, conteos, alertas, escaneos };
  },
};
