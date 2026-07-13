// src/lib/db-productos.ts
// Repositorio de productos: 15 métodos, incluye ajuste de stock atómico.

import { db } from './db';
import { uid, now } from './utils';
import type { Producto, PaginatedResult, TipoMovimiento } from '@/types';
import { PAGE_SIZE_DEFAULT } from '@/types';
import { dbAlertas } from './db-alertas';
import { eventBus } from './eventBus';

interface ListarArgs {
  pagina?: number;
  limite?: number;
  busqueda?: string;
  categoria?: string;
  marca?: string;
  soloBajoStock?: boolean;
  ubicacionId?: string;
  inactivos?: boolean;
}

export const dbProductos = {
  async listar({
    pagina = 1,
    limite = PAGE_SIZE_DEFAULT,
    busqueda,
    categoria,
    marca,
    soloBajoStock,
    ubicacionId,
    inactivos = false,
  }: ListarArgs = {}): Promise<PaginatedResult<Producto>> {
    let coll = db.productos.toCollection();

    coll = coll.filter((p) => {
      if (!inactivos && !p.activo) return false;
      if (inactivos && p.activo) return false;
      if (categoria && p.categoria !== categoria) return false;
      if (marca && p.marca !== marca) return false;
      if (ubicacionId && p.ubicacionId !== ubicacionId) return false;
      if (soloBajoStock && p.stockActual > p.stockMinimo) return false;
      if (busqueda) {
        const q = busqueda.trim().toLowerCase();
        const hit =
          p.nombre.toLowerCase().includes(q) ||
          p.plu.toLowerCase().includes(q) ||
          p.codigoBarras.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });

    const todos = await coll.sortBy('nombre');
    const total = todos.length;
    const start = (pagina - 1) * limite;
    const items = todos.slice(start, start + limite);

    return { items, total, pagina, limite, hasMore: start + limite < total };
  },

  obtener(id: string): Promise<Producto | undefined> {
    return db.productos.get(id);
  },

  obtenerPorPlu(plu: string): Promise<Producto | undefined> {
    return db.productos.where('plu').equals(plu).first();
  },

  obtenerPorCodigoBarras(codigo: string): Promise<Producto | undefined> {
    return db.productos.where('codigoBarras').equals(codigo).first();
  },

  async crear(
    data: Omit<Producto, 'id' | 'createdAt' | 'updatedAt' | 'activo'> &
      Partial<Pick<Producto, 'activo'>>,
  ): Promise<Producto> {
    const producto: Producto = {
      id: uid(),
      activo: true,
      createdAt: now(),
      updatedAt: now(),
      ...data,
    };
    await db.productos.add(producto);
    await dbAlertas.evaluarProducto(producto);
    eventBus.emit();
    return producto;
  },

  async actualizar(id: string, data: Partial<Producto>): Promise<void> {
    await db.productos.update(id, { ...data, updatedAt: now() });
    const p = await db.productos.get(id);
    if (p) await dbAlertas.evaluarProducto(p);
    eventBus.emit();
  },

  /** Soft delete. */
  async eliminar(id: string): Promise<void> {
    await db.productos.update(id, { activo: false, updatedAt: now() });
    eventBus.emit();
  },

  /**
   * Ajuste de stock atómico. Crea movimiento y recalcula alerta en una sola
   * transacción rw sobre productos + movimientos + alertas. Evita stock negativo.
   */
  async ajustarStock(
    id: string,
    cantidad: number,
    tipo: TipoMovimiento,
    motivo: string,
    usuarioId: string,
  ): Promise<{ stockAntes: number; stockDespues: number }> {
    return db.transaction('rw', db.productos, db.movimientos, db.alertas, async () => {
      const p = await db.productos.get(id);
      if (!p) throw new Error('Producto no encontrado');

      const stockAntes = p.stockActual;
      const delta = tipo === 'salida' ? -Math.abs(cantidad) : Math.abs(cantidad);
      const stockDespues =
        tipo === 'ajuste' || tipo === 'conteo'
          ? Math.max(0, cantidad)
          : Math.max(0, stockAntes + delta);

      await db.productos.update(id, { stockActual: stockDespues, updatedAt: now() });
      await db.movimientos.add({
        id: uid(),
        productoId: id,
        tipo,
        cantidad: Math.abs(cantidad),
        stockAntes,
        stockDespues,
        motivo,
        usuarioId,
        conteoId: null,
        createdAt: now(),
      });

      await dbAlertas.evaluarProducto({ ...p, stockActual: stockDespues });
      eventBus.emit();
      return { stockAntes, stockDespues };
    });
  },

  contar(): Promise<number> {
    return db.productos.filter((p) => p.activo).count();
  },

  contarBajoStock(): Promise<number> {
    return db.productos
      .filter((p) => p.activo && p.stockActual <= p.stockMinimo)
      .count();
  },

  contarSinBarras(): Promise<number> {
    return db.productos
      .filter((p) => p.activo && (!p.codigoBarras || p.codigoBarras === ''))
      .count();
  },

  async categorias(): Promise<string[]> {
    const set = new Set<string>();
    await db.productos.filter((p) => p.activo).each((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return [...set].sort();
  },

  async marcas(): Promise<string[]> {
    const set = new Set<string>();
    await db.productos.filter((p) => p.activo).each((p) => {
      if (p.marca) set.add(p.marca);
    });
    return [...set].sort();
  },

  contarPorUbicacion(ubicacionId: string): Promise<number> {
    return db.productos
      .filter((p) => p.activo && p.ubicacionId === ubicacionId)
      .count();
  },

  async obtenerPorUbicacion(ubicacionId: string): Promise<Producto[]> {
    return db.productos
      .where('ubicacionId')
      .equals(ubicacionId as any)
      .filter((p) => p.activo)
      .sortBy('nombre');
  },

  async bulkCrear(
    productos: Array<Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<number> {
    const rows: Producto[] = productos.map((p) => ({
      ...p,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    }));
    await db.productos.bulkAdd(rows);
    await dbAlertas.regenerar();
    eventBus.emit();
    return rows.length;
  },

  async limpiarTodo(): Promise<void> {
    await db.productos.clear();
    await dbAlertas.regenerar();
    eventBus.emit();
  },
};
