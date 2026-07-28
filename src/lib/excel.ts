// src/lib/excel.ts
// Utilidades para importar/exportar productos a Excel - SOLO carga xlsx dinámicamente
// Importación sin fricción: toda fila se importa, datos faltantes se completan después con scraper.

import type { Producto } from '@/types';

async function getXLSX() {
  const mod = await import('xlsx');
  return { utils: mod.utils, write: mod.write, read: mod.read };
}

function parseNumber(val: unknown, defaultVal = 0): number {
  if (val === null || val === undefined || val === '') return defaultVal;
  const n = Number(val);
  return isNaN(n) ? defaultVal : n;
}

function parseString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export interface ImportResult {
  productos: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>[];
  errors: { row: number; message: string }[];
  conflicts: ImportConflict[];
}

export interface ImportConflict {
  row: number;
  type: 'ean' | 'plu' | 'both';
  existing: {
    id: string;
    codigoBarras: string;
    plu: string;
    nombre: string;
    stockActual: number;
    precioVenta: number;
  };
  importData: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>;
  resolution: 'skip' | 'update' | 'create_new';
}

/**
 * Mapeo flexible de headers: recibe un row del Excel (keys = headers de la hoja)
 * y extrae los valores buscando cualquier variación común de nombre de columna.
 */
const HEADER_ALIASES: Record<keyof ProductoInfo, string[]> = {
  plu: ['plu', 'plu ', 'código plu', 'codigo plu', 'codigoplu'],
  codigoBarras: [
    'codigo de barras (ean)', 'código de barras (ean)', 'codigo de barras', 'código de barras',
    'codigo de barras ean', 'código de barras ean', 'ean', 'codigobarras', 'codigo barras',
    'codbarras', 'barras', ' código de barras', 'codigo', 'código', 'cod',
  ],
  nombre: [
    'nombre*', 'nombre producto', 'producto', 'name', 'nombre', 'descripcion del producto',
    'descripción del producto', ' artDescripcion'.trim(), 'articulo', 'artículo', 'artdesc',
  ],
  descripcion: [
    'descripción', 'descripcion', 'description', 'detalle', 'detalles',
    'descripción del producto', 'descripcion del producto', 'observaciones',
  ],
  categoria: ['categoría', 'categoria', 'category', 'rubro', 'categoria del producto',  'categoría del producto'],
  marca: ['marca', 'brand', 'fabricante'],
  precioCompra: [
    'precio compra', 'costo', 'precio de compra', 'precioCosto', 'precio costo',
    'precio unitario', 'costo unitario',
  ],
  precioVenta: [
    'precio venta*', 'precio venta', 'precio de venta', 'precio', 'precioventa',
    'precio de lista', 'precio unitario de venta', 'precio 1', 'precio1', 'precio venta unitario',
    'precio publico', 'precio público', 'precio final',
  ],
  stockActual: [
    'stock actual', 'stock', 'existencia', 'existencias', 'cantidad', 'cant',
    'stock actual del producto', 'inventario', 'unidades', 'stock disponible',
  ],
  stockMinimo: [
    'stock mínimo', 'stock minimo', 'stockmin', 'minimo', 'min', 'mínimo',
  ],
  ubicacionId: ['ubicación id', 'ubicacion id', 'ubicacion', 'ubicación', 'location', 'posicion', 'posición'],
};

type ProductoInfo = {
  plu: string;
  codigoBarras: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  marca: string;
  precioCompra: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  ubicacionId: string | null;
};

/** Busca el valor de un campo dentro del row probando todos sus alias (case-insensitive) */
function getField(row: Record<string, string | number>, field: keyof ProductoInfo): string {
  const aliases = HEADER_ALIASES[field];
  const keys = Object.keys(row).map(k => [k, k.toLowerCase()] as const);
  for (const alias of aliases) {
    for (const [original, lower] of keys) {
      if (lower === alias || lower.replace(/\s+/g, ' ').trim() === alias) {
        return String(row[original] ?? '');
      }
    }
  }
  return '';
}

function workbookToProductos(utils: any, wb: any, existingProducts: Producto[] = []): ImportResult {
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { productos: [], errors: [{ row: 0, message: 'El archivo no tiene hojas con datos' }], conflicts: [] };

  const ws = wb.Sheets[sheetName];
  const rows = (utils as any).sheet_to_json(ws, { defval: '' });

  const productos: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const errors: { row: number; message: string }[] = [];
  const conflicts: ImportConflict[] = [];

  // Build lookup maps for O(1) duplicate detection
  const eanMap = new Map<string, Producto>();
  const pluMap = new Map<string, Producto>();
  existingProducts.forEach(p => {
    if (p.codigoBarras) eanMap.set(p.codigoBarras, p);
    if (p.plu) pluMap.set(p.plu, p);
  });

  rows.forEach((row: Record<string, string | number>, idx: number) => {
    const rowNum = idx + 2;

    // === Extracción flexible de campos (sin validaciones estrictas) ===
    const plu = parseString(getField(row, 'plu'));
    const codigoBarras = parseString(getField(row, 'codigoBarras'));
    let nombre = parseString(getField(row, 'nombre'));
    const descripcionRaw = parseString(getField(row, 'descripcion'));
    const categoriaRaw = parseString(getField(row, 'categoria'));
    const marca = parseString(getField(row, 'marca'));
    const precioCompra = parseNumber(getField(row, 'precioCompra'));
    const precioVenta = parseNumber(getField(row, 'precioVenta'));
    const stockActual = parseNumber(getField(row, 'stockActual'));
    const stockMinimo = parseNumber(getField(row, 'stockMinimo'), 5);
    const ubicacionId = parseString(getField(row, 'ubicacionId')) || null;

    // Si la fila está completamente vacía (todos los campos vacíos), la saltamos
    if (!plu && !codigoBarras && !nombre && !marca && precioVenta === 0 && stockActual === 0) {
      return;
    }

    // Defaults para campos faltantes - el scraper los completará después
    if (!nombre) nombre = 'Producto sin nombre';
    const categoria = categoriaRaw || 'General';
    const descripcion = descripcionRaw || undefined;

    const importData: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'> = {
      plu,
      codigoBarras,
      nombre,
      descripcion,
      categoria,
      marca,
      precioCompra,
      precioVenta,
      stockActual,
      stockMinimo,
      ubicacionId,
      activo: true,
    };

    // Check for conflicts (duplicados)
    const existingByEan = codigoBarras ? eanMap.get(codigoBarras) : null;
    const existingByPlu = plu ? pluMap.get(plu) : null;

    if (existingByEan || existingByPlu) {
      const existing = existingByEan || existingByPlu!;
      const conflictType = existingByEan && existingByPlu ? 'both' : (existingByEan ? 'ean' : 'plu');

      conflicts.push({
        row: rowNum,
        type: conflictType,
        existing: {
          id: existing.id,
          codigoBarras: existing.codigoBarras,
          plu: existing.plu,
          nombre: existing.nombre,
          stockActual: existing.stockActual,
          precioVenta: existing.precioVenta,
        },
        importData,
        resolution: 'skip',
      });
      return;
    }

    productos.push(importData);
  });

  return { productos, errors, conflicts };
}

export async function importProductosFromFile(file: File, existingProducts: Producto[] = []): Promise<ImportResult> {
  const xlsx = await getXLSX();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = xlsx.read(data, { type: 'array' });
        resolve(workbookToProductos(xlsx.utils, wb, existingProducts));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsArrayBuffer(file);
  });
}

export async function exportProductosToExcel(productos: Producto[]): Promise<void> {
  const xlsx = await getXLSX();
  const data = productos.map((p) => ({
    PLU: p.plu,
    'Código de barras (EAN)': p.codigoBarras,
    'Nombre': p.nombre,
    'Descripción': p.descripcion ?? '',
    'Categoría': p.categoria,
    'Marca': p.marca,
    'Precio compra': p.precioCompra,
    'Precio venta': p.precioVenta,
    'Stock actual': p.stockActual,
    'Stock mínimo': p.stockMinimo,
    'Ubicación ID': p.ubicacionId ?? '',
  }));

  const ws = xlsx.utils.json_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Productos');

  const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stockmaster-productos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
