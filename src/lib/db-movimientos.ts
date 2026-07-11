// src/lib/db-movimientos.ts
// Repositorio de movimientos: listar, contar, registrar y movimiento completo atómico.

import { db } from './db';
import { uid, now } from './utils';
import type { Movimiento, PaginatedResult, TipoMovimiento } from '@/types';
import { PAGE_SIZE_DEFAULT } from '@/types';
import { dbAlertas } from './db-alertas';

interface ListarArgs {
  pagina?: number;
  limite?: number;
  productoId?: string;
  tipo?: TipoMovimiento;
  desde?: number;
  hasta?: number;
}

export const dbMovimientos = {
  async listar({
    pagina = 1,
    limite = PAGE_SIZE_DEFAULT,
    productoId,
    tipo,
    desde,
    hasta,
  }: ListarArgs = {}): Promise<PaginatedResult<Movimiento>> {
    const todos = await db.movimientos
      .filter((m) => {
        if (productoId && m.productoId !== productoId) return false;
        if (tipo && m.tipo !== tipo) return false;
        if (desde && m.createdAt < desde) return false;
        if (hasta && m.createdAt > hasta) return false;
        return true;
      })
      .reverse()
      .sortBy('createdAt');

    // sortBy asc + reverse post no aplica a filter; ordenamos manual desc:
    todos.sort((a, b) => b.createdAt - a.createdAt);

    const total = todos.length;
    const start = (pagina - 1) * limite;
    const items = todos.slice(start, start + limite);
    return { items, total, pagina, limite, hasMore: start + limite < total };
  },

  contar(): Promise<number> {
    return db.movimientos.count();
  },

  async registrar(
    data: Omit<Movimiento, 'id' | 'createdAt'>,
  ): Promise<Movimiento> {
    const mov: Movimiento = { id: uid(), createdAt: now(), ...data };
    await db.movimientos.add(mov);
    return mov;
  },

  /**
   * Movimiento completo atómico: lee producto, calcula stock, escribe movimiento,
   * actualiza producto y recalcula alerta. Devuelve el antes/después y el movimiento.
   */
  async registrarMovimientoCompleto({
    productoId,
    tipo,
    cantidad,
    motivo,
    usuarioId,
    conteoId = null,
  }: {
    productoId: string;
    tipo: TipoMovimiento;
    cantidad: number;
    motivo?: string;
    usuarioId: string;
    conteoId?: string | null;
  }): Promise<{ stockAntes: number; stockDespues: number; movimiento: Movimiento }> {
    return db.transaction('rw', db.productos, db.movimientos, db.alertas, async () => {
      const p = await db.productos.get(productoId);
      if (!p) throw new Error('Producto no encontrado');

      const stockAntes = p.stockActual;
      let stockDespues: number;
      if (tipo === 'entrada') stockDespues = stockAntes + Math.abs(cantidad);
      else if (tipo === 'salida') stockDespues = Math.max(0, stockAntes - Math.abs(cantidad));
      else stockDespues = Math.max(0, cantidad); // ajuste / conteo => valor absoluto

      const movimiento: Movimiento = {
        id: uid(),
        productoId,
        tipo,
        cantidad: Math.abs(cantidad),
        stockAntes,
        stockDespues,
        motivo,
        usuarioId,
        conteoId,
        createdAt: now(),
      };

      await db.productos.update(productoId, { stockActual: stockDespues, updatedAt: now() });
      await db.movimientos.add(movimiento);
      await dbAlertas.evaluarProducto({ ...p, stockActual: stockDespues });

      return { stockAntes, stockDespues, movimiento };
    });
  },
};
