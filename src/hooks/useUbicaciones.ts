import { useCallback, useEffect, useState } from 'react';
import type { Ubicacion, UbicacionConHijos } from '@/types';
import { dbUbicaciones } from '@/lib/db-ubicaciones';

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
