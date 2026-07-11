// src/hooks/useMovimientos.ts + src/hooks/useUbicaciones.ts
// (Separalos en dos archivos en tu repo.)
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Movimiento, TipoMovimiento, Ubicacion, UbicacionConHijos } from '@/types';
import { PAGE_SIZE_DEFAULT } from '@/types';
import { dbMovimientos } from '@/lib/db-movimientos';
import { dbUbicaciones } from '@/lib/db-ubicaciones';

/* ==================== src/hooks/useMovimientos.ts ==================== */
interface UseMovimientosArgs {
  productoId?: string;
  tipo?: TipoMovimiento;
  desde?: number;
  hasta?: number;
  limite?: number;
}

export function useMovimientos(args: UseMovimientosArgs = {}) {
  const { limite = PAGE_SIZE_DEFAULT } = args;
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const paginaRef = useRef(1);
  const key = JSON.stringify({ ...args, limite });

  const fetchPagina = useCallback(
    async (pagina: number, append: boolean) => {
      setCargando(true);
      setError(null);
      try {
        const res = await dbMovimientos.listar({ ...args, pagina, limite });
        setMovimientos((prev) => (append ? [...prev, ...res.items] : res.items));
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

  const recargar = useCallback(() => fetchPagina(1, false), [fetchPagina]);

  return { movimientos, total, hasMore, cargando, error, cargarMas, recargar };
}

/* ==================== src/hooks/useUbicaciones.ts ==================== */
export function useUbicaciones() {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [arbol, setArbol] = useState<UbicacionConHijos[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [lista, tree] = await Promise.all([
        dbUbicaciones.listar(),
        dbUbicaciones.construirArbol(),
      ]);
      setUbicaciones(lista);
      setArbol(tree);
    } catch (e) {
      setError(e as Error);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { ubicaciones, arbol, cargando, error, recargar };
}
