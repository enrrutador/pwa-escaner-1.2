// src/app/api/buscar/route.ts
// GET /api/buscar?q=<codigo|texto>
// 4 proveedores en paralelo (Promise.allSettled, timeout 5s), dedup, max 8.

import { NextRequest, NextResponse } from 'next/server';
import type { ResultadoBusqueda } from '@/types';

// Usar Node.js runtime para fetch externo sin problemas de CORS/edge
export const runtime = 'nodejs';

const TIMEOUT_MS = 5000;

const VTEX_BASES: Record<'jumbo' | 'carrefour' | 'farmacity', string> = {
  jumbo: 'https://www.jumbo.com.ar',
  carrefour: 'https://www.carrefour.com.ar',
  farmacity: 'https://www.farmacity.com',
};

const COTO_AUTOCOMPLETE = 'https://ac.cnstrc.com/autocomplete';
const COTO_KEY = process.env.CONSTRUCTOR_KEY ?? '';

function normalizar(nombre: string): string {
  return nombre.trim().toLowerCase().slice(0, 30);
}

async function fetchConTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function buscarVtex(
  fuente: 'jumbo' | 'carrefour' | 'farmacity',
  q: string,
  esEan: boolean,
): Promise<ResultadoBusqueda[]> {
  const base = VTEX_BASES[fuente];
  const url = esEan
    ? `${base}/api/catalog_system/pub/products/search/?fq=EAN:${encodeURIComponent(q)}`
    : `${base}/api/catalog_system/pub/products/search/?ft=${encodeURIComponent(q)}`;

  console.log(`[buscar] ${fuente} -> ${url}`);
  const res = await fetchConTimeout(url, { headers: { Accept: 'application/json' } });
  console.log(`[buscar] ${fuente} status: ${res.status}`);
  if (!res.ok) return [];
  const data = (await res.json()) as any[];
  console.log(`[buscar] ${fuente} items: ${data?.length ?? 0}`);

  return (data ?? []).map((p) => {
    const item = p.items?.[0];
    const seller = item?.sellers?.[0]?.commertialOffer;
    return {
      nombre: p.productName ?? p.productTitle ?? 'Sin nombre',
      codigoBarras: item?.ean ?? undefined,
      imagen: item?.images?.[0]?.imageUrl ?? undefined,
      descripcion: p.description ?? undefined,
      precio: seller?.Price ?? undefined,
      fuente,
    } satisfies ResultadoBusqueda;
  });
}

async function buscarCoto(q: string): Promise<ResultadoBusqueda[]> {
  if (!COTO_KEY) return [];
  const url = `${COTO_AUTOCOMPLETE}/${encodeURIComponent(q)}?key=${COTO_KEY}&num_results=1`;
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
    fuente: 'coto' as const,
  }));
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

  const settled = await Promise.allSettled([
    buscarVtex('jumbo', q, esEan),
    buscarVtex('carrefour', q, esEan),
    buscarVtex('farmacity', q, esEan),
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

  console.log(`[buscar] total antes dedup: ${todos.length}`);
  const final = deduplicar(todos);
  console.log(`[buscar] final: ${final.length}`);
  return NextResponse.json({ resultados: final });
}