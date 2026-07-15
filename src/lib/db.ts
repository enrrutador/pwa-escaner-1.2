// src/lib/db.ts
// Dexie / IndexedDB — schema v4, 3 migraciones, seed opcional.
// Offline-first. Solo cliente ('use client' en los consumidores).

import Dexie, { type Table } from 'dexie';
import type {
  Producto,
  Ubicacion,
  Movimiento,
  Usuario,
  Conteo,
  ConteoItem,
  Alerta,
  Escaneo,
} from '@/types';

export class StockMasterDB extends Dexie {
  productos!: Table<Producto, string>;
  ubicaciones!: Table<Ubicacion, string>;
  movimientos!: Table<Movimiento, string>;
  usuarios!: Table<Usuario, string>;
  conteos!: Table<Conteo, string>;
  conteoItems!: Table<ConteoItem, string>;
  alertas!: Table<Alerta, string>;
  escaneos!: Table<Escaneo, string>;

  constructor() {
    super('inventario_app');

    /* ---------- v1: schema inicial ---------- */
    this.version(1).stores({
      productos:
        'id, plu, codigoBarras, nombre, categoria, marca, ubicacionId, activo, stockActual, stockMinimo',
      ubicaciones: 'id, parentId, tipo, activo',
      movimientos: 'id, productoId, tipo, usuarioId, conteoId, createdAt',
      usuarios: 'id, &nombre, rol, activo',
      conteos: 'id, estado, tipo, createdAt',
      conteoItems: 'id, conteoId, productoId',
      alertas: 'id, productoId, tipo, leida, createdAt',
      escaneos: 'id, codigo, resultado, createdAt',
    });

    /* ---------- v2: boolean fix (0/1 -> false/true) ---------- */
    this.version(2)
      .stores({}) // sin cambios de índices
      .upgrade(async (tx) => {
        const toBool = (v: unknown) => v === true || v === 1 || v === '1';
        await tx.table('productos').toCollection().modify((p: any) => {
          p.activo = toBool(p.activo);
        });
        await tx.table('ubicaciones').toCollection().modify((u: any) => {
          u.activo = toBool(u.activo);
        });
        await tx.table('usuarios').toCollection().modify((u: any) => {
          u.activo = toBool(u.activo);
        });
        await tx.table('alertas').toCollection().modify((a: any) => {
          a.leida = toBool(a.leida);
        });
      });

    /* ---------- v3: timestamps string -> number(ms) ---------- */
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        const toMs = (v: unknown) => {
          if (typeof v === 'number') return v;
          const t = Date.parse(String(v));
          return Number.isNaN(t) ? Date.now() : t;
        };
        for (const tabla of ['movimientos', 'alertas', 'escaneos']) {
          await tx.table(tabla).toCollection().modify((row: any) => {
            row.createdAt = toMs(row.createdAt);
          });
        }
      });

    /* ---------- v4: PLU no único + limpieza ---------- */
    this.version(4)
      .stores({
        // plu deja de ser único (ya era no-único en v1, pero se reafirma el índice)
        productos:
          'id, plu, codigoBarras, nombre, categoria, marca, ubicacionId, activo, stockActual, stockMinimo',
      })
      .upgrade(async (tx) => {
        await tx.table('productos').toCollection().modify((p: any) => {
          if (p.plu == null) p.plu = '';
        });
      });
  }
}

export const db = new StockMasterDB();
