// src/hooks/useProductos.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Producto } from '@/types';
import { PAGE_SIZE_DEFAULT } from '@/types';
import { dbProductos } from '@/lib/db-productos';

interface UseProductosArgs {
  busqueda?: string;
  categoria?: string;
  marca?: string;
  soloBajoStock?: boolean;
  ubicacionId?: string;
  inactivos?: boolean;
  limite?: number;
}

interface UseProductosReturn {
  productos: Producto[];
  total: number;
  hasMore: boolean;
  cargando: boolean;
  error: Error | null;
  cargarMas: () => Promise<void>;
  recargar: () => Promise<void>;
}

export function useProductos(args: UseProductosArgs = {}): UseProductosReturn {
  const { limite = PAGE_SIZE_DEFAULT } = args;
  const [productos, setProductos] = useState<Producto[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const paginaRef = useRef(1);

  // clave estable de filtros para disparar recarga
  const key = JSON.stringify({ ...args, limite });

  const fetchPagina = useCallback(
    async (pagina: number, append: boolean) => {
      setCargando(true);
      setError(null);
      try {
        const res = await dbProductos.listar({ ...args, pagina, limite });
        setProductos((prev) => (append ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setHasMore(res.hasMore);
        paginaRef.current = pagina;
      } catch (e) {
        setError(e as Error);
      } finally {
        setCargando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    paginaRef.current = 1;
    fetchPagina(1, false);
  }, [fetchPagina]);

  const cargarMas = useCallback(async () => {
    if (!hasMore || cargando) return;
    await fetchPagina(paginaRef.current + 1, true);
  }, [hasMore, cargando, fetchPagina]);

  const recargar = useCallback(async () => {
    await fetchPagina(1, false);
  }, [fetchPagina]);

  return { productos, total, hasMore, cargando, error, cargarMas, recargar };
}
