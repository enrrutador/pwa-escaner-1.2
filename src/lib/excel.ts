// src/lib/excel.ts
// Utilidades para importar/exportar productos a Excel - SOLO carga xlsx dinámicamente

import type { Producto } from '@/types';

const EXCEL_HEADERS = [
  { key: 'plu', label: 'PLU' },
  { key: 'codigoBarras', label: 'Código de barras (EAN)' },
  { key: 'nombre', label: 'Nombre*' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'marca', label: 'Marca' },
  { key: 'precioCompra', label: 'Precio compra' },
  { key: 'precioVenta', label: 'Precio venta*' },
  { key: 'stockActual', label: 'Stock actual' },
  { key: 'stockMinimo', label: 'Stock mínimo' },
  { key: 'ubicacionId', label: 'Ubicación ID' },
];

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
}

function workbookToProductos(wb: any): ImportResult {
  const utils = (wb as any).utils;
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { productos: [], errors: [{ row: 0, message: 'Hoja vacía' }] };

  const ws = wb.Sheets[sheetName];
  const rows = (utils as any).sheet_to_json(ws, { defval: '' });

  const productos: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((row: Record<string, string | number>, idx: number) => {
    const rowNum = idx + 2;

    const nombre = parseString(row['Nombre*'] ?? row['Nombre']);
    if (!nombre) {
      errors.push({ row: rowNum, message: 'Nombre es obligatorio' });
      return;
    }

    const precioVenta = parseNumber(row['Precio venta*'] ?? row['Precio venta']);
    if (precioVenta <= 0) {
      errors.push({ row: rowNum, message: 'Precio venta debe ser > 0' });
      return;
    }

    const plu = parseString(row['PLU']);
    const codigoBarras = parseString(row['Código de barras (EAN)'] ?? row['Codigo de barras']);

    if (!plu && !codigoBarras) {
      errors.push({ row: rowNum, message: 'Debe tener PLU o Código de barras' });
      return;
    }

    productos.push({
      plu,
      codigoBarras,
      nombre,
      descripcion: parseString(row['Descripción']) || undefined,
      categoria: parseString(row['Categoría']) || 'General',
      marca: parseString(row['Marca']) || '',
      precioCompra: parseNumber(row['Precio compra']),
      precioVenta,
      stockActual: parseNumber(row['Stock actual']),
      stockMinimo: parseNumber(row['Stock mínimo'], 5),
      ubicacionId: parseString(row['Ubicación ID']) || null,
      activo: true,
    });
  });

  return { productos, errors };
}

export async function importProductosFromFile(file: File): Promise<ImportResult> {
  const xlsx = await getXLSX();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = xlsx.read(data, { type: 'array' });
        resolve(workbookToProductos(wb));
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
    'Nombre*': p.nombre,
    Descripción: p.descripcion ?? '',
    Categoría: p.categoria,
    Marca: p.marca,
    'Precio compra': p.precioCompra,
    'Precio venta*': p.precioVenta,
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

export async function generateTemplateExcel(): Promise<void> {
  const xlsx = await getXLSX();
  const ejemplo: Producto = {
    id: '',
    plu: '1001',
    codigoBarras: '7790070012345',
    nombre: 'Producto ejemplo',
    descripcion: 'Descripción opcional',
    categoria: 'General',
    marca: 'Marca ejemplo',
    precioCompra: 100.5,
    precioVenta: 150.75,
    stockActual: 10,
    stockMinimo: 5,
    ubicacionId: null,
    activo: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const data = [{
    PLU: ejemplo.plu,
    'Código de barras (EAN)': ejemplo.codigoBarras,
    'Nombre*': ejemplo.nombre,
    Descripción: ejemplo.descripcion ?? '',
    Categoría: ejemplo.categoria,
    Marca: ejemplo.marca,
    'Precio compra': ejemplo.precioCompra,
    'Precio venta*': ejemplo.precioVenta,
    'Stock actual': ejemplo.stockActual,
    'Stock mínimo': ejemplo.stockMinimo,
    'Ubicación ID': ejemplo.ubicacionId ?? '',
  }];

  const ws = xlsx.utils.json_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Productos');

  const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-importacion-productos.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}