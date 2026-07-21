// src/lib/db-productos.ts
// Repositorio de productos: 15 métodos, incluye ajuste de stock atómico.

import { db } from './db';
import { uid, now } from './utils';
import type { Producto, PaginatedResult, TipoMovimiento } from '@/types';
import { PAGE_SIZE_DEFAULT } from '@/types';
import { dbAlertas } from './db-alertas';
import { eventBus } from './eventBus';
import { checkAuth } from './auth-guard';

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
    // Usar filter en vez de where('activo').equals() porque activo es boolean
    // y el índice numérico no coincide可靠mente con true/false entre versiones
    let coll = db.productos.filter((p: any) => inactivos ? !p.activo : p.activo);

    // Aplicar filtros exactos
    if (categoria) coll = coll.filter((p: any) => p.categoria === categoria);
    if (marca) coll = coll.filter((p: any) => p.marca === marca);
    if (ubicacionId) coll = coll.filter((p: any) => p.ubicacionId === ubicacionId);
    if (soloBajoStock) coll = coll.filter((p: any) => p.stockActual > 0 && p.stockActual <= p.stockMinimo);

    // Búsqueda por texto
    if (busqueda) {
      const q = busqueda.trim().toLowerCase();
      coll = coll.filter((p: any) =>
        p.nombre?.toLowerCase().includes(q) ||
        p.plu?.toLowerCase().includes(q) ||
        p.codigoBarras?.toLowerCase().includes(q)
      );
    }

    // Contar total ANTES de paginar
    const total = await coll.count();

    // Ordenar por nombre y paginar
    const todos = await coll.sortBy('nombre');
    const offset = (pagina - 1) * limite;
    const items = todos.slice(offset, offset + limite);

    return { items, total, pagina, limite, hasMore: offset + items.length < total };
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
    const auth = await checkAuth('productos:crear');
    if (!auth.ok) throw new Error(auth.error || 'Sin permisos');
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
    const auth = await checkAuth('productos:editar');
    if (!auth.ok) throw new Error(auth.error || 'Sin permisos');
    await db.productos.update(id, { ...data, updatedAt: now() });
    const p = await db.productos.get(id);
    if (p) await dbAlertas.evaluarProducto(p);
    eventBus.emit();
  },

  /** Soft delete. */
  async eliminar(id: string): Promise<void> {
    const auth = await checkAuth('productos:eliminar');
    if (!auth.ok) throw new Error(auth.error || 'Sin permisos');
    await db.productos.update(id, { activo: false, updatedAt: now() });
    eventBus.emit();
  },

  /**
   * Ajuste de stock atómico. Crea movimiento y recalcula alerta en una sola
   * transacción rw sobre productos + movimientos + alertas. Evita stock negativo.
   * Devuelve el producto actualizado completo.
   */
  async ajustarStock(
    id: string,
    cantidad: number,
    tipo: TipoMovimiento,
    motivo: string,
    usuarioId: string,
  ): Promise<Producto> {
    const auth = await checkAuth('stock:ajustar');
    if (!auth.ok) throw new Error(auth.error || 'Sin permisos');
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

      const productoActualizado = await db.productos.get(id);
      if (!productoActualizado) throw new Error('Producto no encontrado tras actualización');

      await dbAlertas.evaluarProducto(productoActualizado);
      eventBus.emit();
      return productoActualizado;
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
