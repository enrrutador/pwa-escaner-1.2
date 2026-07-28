// src/lib/autocompletar.ts
// Autocompletado de productos con datos faltantes usando el scraper /api/buscar.
// Se ejecuta en background después de importar un Excel con filas incompletas.
// No bloquea al usuario: dispara peticiones en lotes pequeños y actualiza IndexedDB.

import { dbProductos } from './db-productos';
import type { Producto } from '@/types';

/** Marca un producto como "necesita autocompletar" */
function necesitaCompletar(p: Producto): boolean {
  return (
    p.nombre === 'Producto sin nombre' ||
    !p.marca ||
    !p.codigoBarras ||
    !p.imagen ||
    p.precioVenta === 0
  );
}

interface ScraperResultado {
  resultados: Array<{
    nombre?: string;
    codigoBarras?: string;
    imagen?: string;
    descripcion?: string;
    precio?: number;
    marca?: string;
  }>;
}

async function buscarEnScraper(query: string): Promise<ScraperResultado['resultados']> {
  try {
    const res = await fetch(`/api/buscar?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data: ScraperResultado = await res.json();
    return data.resultados || [];
  } catch {
    return [];
  }
}

async function autocompletarProducto(producto: Producto): Promise<boolean> {
  // Prioridad de query: EAN > PLU > nombre
  const query = producto.codigoBarras || producto.plu || producto.nombre;
  if (!query || query === 'Producto sin nombre') return false;

  const resultados = await buscarEnScraper(query);
  if (resultados.length === 0) return false;

  const r = resultados[0];
  const actualizaciones: Partial<Producto> = {};
  let cambio = false;

  if (r.nombre && producto.nombre === 'Producto sin nombre') {
    actualizaciones.nombre = r.nombre;
    cambio = true;
  }
  if (r.marca && !producto.marca) {
    actualizaciones.marca = r.marca;
    cambio = true;
  }
  if (r.codigoBarras && !producto.codigoBarras) {
    actualizaciones.codigoBarras = r.codigoBarras;
    cambio = true;
  }
  if (r.imagen && !producto.imagen) {
    actualizaciones.imagen = r.imagen;
    cambio = true;
  }
  if (r.descripcion && !producto.descripcion) {
    actualizaciones.descripcion = r.descripcion;
    cambio = true;
  }
  if (r.precio && r.precio > 0 && producto.precioVenta === 0) {
    actualizaciones.precioVenta = r.precio;
    cambio = true;
  }

  if (cambio) {
    try {
      await dbProductos.actualizar(producto.id, actualizaciones);
    } catch {
      // Si la actualización falla (ej: sin permisos), no rompemos el flujo
    }
  }
  return cambio;
}

export interface AutocompletarProgreso {
  total: number;
  procesados: number;
  completados: number;
  estado: 'inactivo' | 'procesando' | 'finalizado';
}

export async function autocompletarPendientes(
  onProgreso?: (p: AutocompletarProgreso) => void
): Promise<{ total: number; completados: number }> {
  const { items } = await dbProductos.listar({ limite: 10000 });
  const pendientes = items.filter(necesitaCompletar);

  const total = pendientes.length;
  if (total === 0) {
    onProgreso?.({ total: 0, procesados: 0, completados: 0, estado: 'finalizado' });
    return { total: 0, completados: 0 };
  }

  let procesados = 0;
  let completados = 0;

  onProgreso?.({ total, procesados, completados, estado: 'procesando' });

  for (const p of pendientes) {
    const ok = await autocompletarProducto(p);
    if (ok) completados++;
    procesados++;
    onProgreso?.({ total, procesados, completados, estado: 'procesando' });
    // Espera corta para no saturar las APIs de los supermercados
    await new Promise((r) => setTimeout(r, 250));
  }

  onProgreso?.({ total, procesados, completados, estado: 'finalizado' });
  return { total, completados };
}
