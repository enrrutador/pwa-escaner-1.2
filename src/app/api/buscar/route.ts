// src/app/api/buscar/route.ts
// GET /api/buscar?q=<codigo|texto>
// Uses VTEX intelligent search (works for EAN + text) + Coto Constructor.io

import { NextRequest, NextResponse } from 'next/server';
import type { ResultadoBusqueda } from '@/types';

export const runtime = 'nodejs';

const TIMEOUT_MS = 6000;

const VTEX_STORES: Record<string, string> = {
  jumbo: 'https://www.jumbo.com.ar',
  carrefour: 'https://www.carrefour.com.ar',
  farmacity: 'https://www.farmacity.com',
};

const COTO_AUTOCOMPLETE = 'https://ac.cnstrc.com/autocomplete';
const COTO_KEY = process.env.CONSTRUCTOR_KEY ?? '';

async function fetchConTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function normalizar(nombre: string): string {
  return nombre.trim().toLowerCase().slice(0, 30);
}

/** VTEX intelligent search — works for both EAN and text queries */
async function buscarVtexIntelligent(
  fuente: string,
  base: string,
  q: string,
): Promise<ResultadoBusqueda[]> {
  try {
    const url = `${base}/api/io/_v/api/intelligent-search/product_search/${encodeURIComponent(q)}?locale=es-AR`;
    console.log(`[buscar] ${fuente} intelligent -> ${url}`);
    const res = await fetchConTimeout(url, { headers: { Accept: 'application/json' } });
    console.log(`[buscar] ${fuente} status: ${res.status}`);
    if (!res.ok) return [];

    const data = (await res.json()) as any;
    const products = data?.products ?? [];
    console.log(`[buscar] ${fuente} ${products.length} items`);
    if (products.length === 0) return [];

    return products.slice(0, 4).map((p: any) => {
      const item = p.items?.[0];
      const seller = item?.sellers?.[0]?.commertialOffer;
      const img = item?.images?.[0]?.imageUrl ?? p.items?.[0]?.images?.[0]?.imageUrl;
      return {
        nombre: p.productName ?? 'Sin nombre',
        codigoBarras: item?.ean ?? undefined,
        imagen: img ?? undefined,
        descripcion: p.description ?? undefined,
        precio: seller?.Price ?? p.priceRange?.sellingPrice?.lowPrice ?? undefined,
        marca: p.brand ?? undefined,
        fuente,
      } satisfies ResultadoBusqueda;
    });
  } catch (e) {
    console.error(`[buscar] ${fuente} error:`, e);
    return [];
  }
}

/** Fallback: VTEX catalog search (text only) */
async function buscarVtexCatalog(
  fuente: string,
  base: string,
  q: string,
): Promise<ResultadoBusqueda[]> {
  try {
    const url = `${base}/api/catalog_system/pub/products/search/?ft=${encodeURIComponent(q)}`;
    console.log(`[buscar] ${fuente} catalog -> ${url}`);
    const res = await fetchConTimeout(url, { headers: { Accept: 'application/json' } });
    console.log(`[buscar] ${fuente} catalog status: ${res.status}`);
    if (!res.ok) return [];
    const data = (await res.json()) as any[];
    if (!Array.isArray(data) || data.length === 0) return [];
    console.log(`[buscar] ${fuente} catalog ${data.length} items`);

    return data.slice(0, 4).map((p) => {
      const item = p.items?.[0];
      const seller = item?.sellers?.[0]?.commertialOffer;
      return {
        nombre: p.productName ?? 'Sin nombre',
        codigoBarras: item?.ean ?? undefined,
        imagen: item?.images?.[0]?.imageUrl ?? undefined,
        descripcion: p.description ?? undefined,
        precio: seller?.Price ?? undefined,
        marca: p.brand ?? undefined,
        fuente,
      } satisfies ResultadoBusqueda;
    });
  } catch (e) {
    console.error(`[buscar] ${fuente} catalog error:`, e);
    return [];
  }
}

async function buscarCoto(q: string): Promise<ResultadoBusqueda[]> {
  if (!COTO_KEY) return [];
  try {
    const url = `${COTO_AUTOCOMPLETE}/${encodeURIComponent(q)}?key=${COTO_KEY}&num_results=3`;
    console.log(`[buscar] coto -> ${url}`);
    const res = await fetchConTimeout(url);
    console.log(`[buscar] coto status: ${res.status}`);
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const items = data?.sections?.Products ?? [];
    return items.map((it: any) => ({
      nombre: it.value ?? 'Sin nombre',
      codigoBarras: it.data?.ean ?? undefined,
      imagen: it.data?.image_url ?? undefined,
      precio: it.data?.price ?? undefined,
      marca: it.data?.brand ?? undefined,
      fuente: 'coto',
    }));
  } catch (e) {
    console.error('[buscar] coto error:', e);
    return [];
  }
}

function deduplicar(resultados: ResultadoBusqueda[]): ResultadoBusqueda[] {
  const mapa = new Map<string, ResultadoBusqueda>();
  for (const r of resultados) {
    const clave = r.codigoBarras || normalizar(r.nombre);
    const existente = mapa.get(clave);
    if (!existente) {
      mapa.set(clave, r);
    } else if (!existente.imagen && r.imagen) {
      mapa.set(clave, r);
    }
  }
  return [...mapa.values()].slice(0, 8);
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json({ resultados: [] });

  const esEan = /^\d{8,13}$/.test(q);
  console.log(`[buscar] query: "${q}" esEan: ${esEan}`);

  // Try intelligent search first (handles both EAN and text)
  // Then fall back to catalog search if needed
  const settled = await Promise.allSettled([
    buscarVtexIntelligent('jumbo', VTEX_STORES.jumbo, q),
    buscarVtexIntelligent('carrefour', VTEX_STORES.carrefour, q),
    buscarVtexIntelligent('farmacity', VTEX_STORES.farmacity, q),
    buscarCoto(q),
  ]);

  const todos: ResultadoBusqueda[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      console.log(`[buscar] ${s.value.length} resultados de proveedor`);
      todos.push(...s.value);
    } else {
      console.error('[buscar] error:', s.reason);
    }
  }

  // If no results from intelligent search, try catalog fallback
  if (todos.length === 0) {
    console.log('[buscar] intelligent search vacío, intentando catalog fallback');
    const fallback = await Promise.allSettled([
      buscarVtexCatalog('jumbo', VTEX_STORES.jumbo, q),
      buscarVtexCatalog('carrefour', VTEX_STORES.carrefour, q),
      buscarVtexCatalog('farmacity', VTEX_STORES.farmacity, q),
    ]);
    for (const s of fallback) {
      if (s.status === 'fulfilled') todos.push(...s.value);
    }
  }

  console.log(`[buscar] total antes dedup: ${todos.length}`);
  const final = deduplicar(todos);
  console.log(`[buscar] final: ${final.length}`);
  return NextResponse.json({ resultados: final });
}
