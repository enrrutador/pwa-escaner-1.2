// src/lib/db-conteos.ts
// Repositorio de conteos: CRUD + items + finalización transaccional.

import { db } from './db';
import { uid, now } from './utils';
import type { Conteo, ConteoItem } from '@/types';
import { dbAlertas } from './db-alertas';

export const dbConteos = {
  listar(): Promise<Conteo[]> {
    return db.conteos.reverse().sortBy('createdAt');
  },

  obtener(id: string): Promise<Conteo | undefined> {
    return db.conteos.get(id);
  },

  async crear(
    data: Omit<Conteo, 'id' | 'createdAt' | 'estado' | 'finalizadoAt'> &
      Partial<Pick<Conteo, 'estado'>>,
  ): Promise<Conteo> {
    const conteo: Conteo = {
      id: uid(),
      estado: 'abierto',
      createdAt: now(),
      finalizadoAt: null,
      ...data,
    };
    await db.conteos.add(conteo);
    return conteo;
  },

  async actualizar(id: string, data: Partial<Conteo>): Promise<void> {
    await db.conteos.update(id, data);
  },

  async eliminar(id: string): Promise<void> {
    await db.transaction('rw', db.conteos, db.conteoItems, async () => {
      await db.conteoItems.where('conteoId').equals(id).delete();
      await db.conteos.delete(id);
    });
  },

  async agregarItem(
    conteoId: string,
    productoId: string,
    cantidadSistema: number,
  ): Promise<ConteoItem> {
    const item: ConteoItem = {
      id: uid(),
      conteoId,
      productoId,
      cantidadSistema,
      cantidadFisica: null,
    };
    await db.conteoItems.add(item);
    return item;
  },

  /**
   * Finaliza un conteo: por cada item con diferencia genera un movimiento tipo
   * 'conteo', actualiza stock del producto y recalcula alertas. Todo atómico.
   */
  async finalizar(
    conteoId: string,
    items: Array<{ productoId: string; cantidadFisica: number }>,
    usuarioId: string,
  ): Promise<{ ajustados: number }> {
    return db.transaction(
      'rw',
      db.conteos,
      db.conteoItems,
      db.productos,
      db.movimientos,
      db.alertas,
      async () => {
        let ajustados = 0;
        for (const { productoId, cantidadFisica } of items) {
          const p = await db.productos.get(productoId);
          if (!p) continue;
          if (p.stockActual !== cantidadFisica) {
            await db.movimientos.add({
              id: uid(),
              productoId,
              tipo: 'conteo',
              cantidad: Math.abs(cantidadFisica - p.stockActual),
              stockAntes: p.stockActual,
              stockDespues: cantidadFisica,
              motivo: `Conteo ${conteoId}`,
              usuarioId,
              conteoId,
              createdAt: now(),
            });
            await db.productos.update(productoId, {
              stockActual: cantidadFisica,
              updatedAt: now(),
            });
            await dbAlertas.evaluarProducto({ ...p, stockActual: cantidadFisica });
            ajustados++;
          }
        }
        await db.conteos.update(conteoId, {
          estado: 'finalizado',
          finalizadoAt: now(),
        });
        return { ajustados };
      },
    );
  },
};
