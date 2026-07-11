// src/lib/db-alertas.ts
// Repositorio de alertas. Fuente única de verdad: stockActual vs stockMinimo.

import { db } from './db';
import { uid, now } from './utils';
import type { Alerta, Producto, TipoAlerta } from '@/types';

function tipoAlertaPara(p: Producto): TipoAlerta | null {
  if (p.stockActual <= 0) return 'sin_stock';
  if (p.stockActual <= p.stockMinimo) return 'stock_bajo';
  return null;
}

export const dbAlertas = {
  listar(soloNoLeidas = false): Promise<Alerta[]> {
    const coll = soloNoLeidas
      ? db.alertas.filter((a) => !a.leida)
      : db.alertas.toCollection();
    return coll.reverse().sortBy('createdAt');
  },

  contarNoLeidas(): Promise<number> {
    return db.alertas.filter((a) => !a.leida).count();
  },

  async marcarLeida(id: string): Promise<void> {
    await db.alertas.update(id, { leida: true });
  },

  async marcarTodasLeidas(): Promise<void> {
    await db.alertas.toCollection().modify({ leida: true });
  },

  /** Evalúa un producto: crea o quita su alerta según stock. Idempotente. */
  async evaluarProducto(p: Producto): Promise<void> {
    const tipo = tipoAlertaPara(p);
    const existentes = await db.alertas.where('productoId').equals(p.id).toArray();

    if (!tipo) {
      if (existentes.length) await db.alertas.bulkDelete(existentes.map((a) => a.id));
      return;
    }

    const yaIgual = existentes.find((a) => a.tipo === tipo);
    if (yaIgual) {
      // limpia duplicados de otro tipo
      const otros = existentes.filter((a) => a.id !== yaIgual.id);
      if (otros.length) await db.alertas.bulkDelete(otros.map((a) => a.id));
      return;
    }

    if (existentes.length) await db.alertas.bulkDelete(existentes.map((a) => a.id));
    const alerta: Alerta = {
      id: uid(),
      productoId: p.id,
      tipo,
      leida: false,
      createdAt: now(),
    };
    await db.alertas.add(alerta);
  },

  /** Recalcula TODAS las alertas desde el estado actual de los productos. */
  async regenerar(): Promise<number> {
    return db.transaction('rw', db.productos, db.alertas, async () => {
      await db.alertas.clear();
      const productos = await db.productos.filter((p) => p.activo).toArray();
      const nuevas: Alerta[] = [];
      for (const p of productos) {
        const tipo = tipoAlertaPara(p);
        if (tipo) {
          nuevas.push({
            id: uid(),
            productoId: p.id,
            tipo,
            leida: false,
            createdAt: now(),
          });
        }
      }
      if (nuevas.length) await db.alertas.bulkAdd(nuevas);
      return nuevas.length;
    });
  },
};
