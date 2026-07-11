// src/lib/seed.ts
// Seed inicial: admin Marcelo/1234 + 4 productos demo con alertas.

import { db } from './db';
import { dbUsuarios } from './db-usuarios';
import { dbProductos } from './db-productos';
import { dbUbicaciones } from './db-ubicaciones';
import { dbAlertas } from './db-alertas';
import { hashPin } from './utils';

const DEMO_PRODUCTOS = [
  {
    plu: '0001',
    codigoBarras: '7790070001234',
    nombre: 'Leche Entera 1L',
    categoria: 'Lácteos',
    marca: 'La Serenísima',
    ubicacionId: null,
    precioCompra: 850,
    precioVenta: 1200,
    stockActual: 5,
    stockMinimo: 10,
  },
  {
    plu: '0002',
    codigoBarras: '7790070005678',
    nombre: 'Yogur Natural 170g',
    categoria: 'Lácteos',
    marca: 'La Serenísima',
    ubicacionId: null,
    precioCompra: 400,
    precioVenta: 650,
    stockActual: 0,
    stockMinimo: 8,
  },
  {
    plu: '0003',
    codigoBarras: '7790070009012',
    nombre: 'Queso Cremoso 300g',
    categoria: 'Lácteos',
    marca: 'Milky',
    ubicacionId: null,
    precioCompra: 1200,
    precioVenta: 1800,
    stockActual: 25,
    stockMinimo: 5,
  },
  {
    plu: '0004',
    codigoBarras: '7790070003456',
    nombre: 'Manteca 200g',
    categoria: 'Lácteos',
    marca: 'La Serenísima',
    ubicacionId: null,
    precioCompra: 900,
    precioVenta: 1400,
    stockActual: 3,
    stockMinimo: 6,
  },
];

export async function seedSiVacio(): Promise<void> {
  const count = await db.productos.count();
  if (count > 0) return;

  // Usuario admin
  await dbUsuarios.crear({ nombre: 'Marcelo', pin: '1234', rol: 'admin' });

  // Ubicación raíz
  const deposito = await dbUbicaciones.crear({
    nombre: 'Depósito Central',
    parentId: null,
    tipo: 'deposito',
  });

  // Productos demo
  for (const p of DEMO_PRODUCTOS) {
    const prod = await dbProductos.crear({ ...p, ubicacionId: deposito.id });
    await dbAlertas.evaluarProducto(prod);
  }
}
