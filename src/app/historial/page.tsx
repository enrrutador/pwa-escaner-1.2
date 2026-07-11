'use client';

import { useState, useEffect } from 'react';
import { formatMoney } from '@/lib/utils';
import { dbMovimientos } from '@/lib/db-movimientos';
import { dbConteos } from '@/lib/db-conteos';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

type Filtro = 'todos' | 'entradas' | 'salidas' | 'ajustes' | 'conteos';

export default function Historial() {
  const { tienePermiso } = useAuthStore();
  const { mostrarToast } = useUIStore();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [conteos, setConteos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [pagina, setPagina] = useState(1);

  const cargar = async (pag = 1, append = false) => {
    setCargando(true);
    try {
      if (filtro === 'conteos') {
        const c = await dbConteos.listar();
        setConteos(c);
        setMovimientos([]);
      } else {
        const tipo = filtro === 'todos' ? undefined : filtro.slice(0, -1) as any;
        const res = await dbMovimientos.listar({ tipo, pagina: pag, limite: 20 });
        setMovimientos(append ? [...movimientos, ...res.items] : res.items);
        setHasMore(res.hasMore);
      }
    } catch (e: any) {
      mostrarToast('error', e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    setPagina(1);
    cargar(1, false);
  }, [filtro]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Historial</h1>
          <p className="text-zinc-400 text-sm">Movimientos y conteos</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['todos', 'entradas', 'salidas', 'ajustes', 'conteos'] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              filtro === f
                ? 'bg-cyan-500 text-navy-950 font-semibold'
                : 'bg-navy-800 text-zinc-300 hover:bg-navy-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtro === 'conteos' ? (
        <div className="bg-navy-900/50 border border-navy-700 rounded-xl overflow-hidden">
          {conteos.length === 0 && !cargando ? (
            <p className="p-8 text-center text-zinc-500">No hay conteos registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-navy-700">
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Creado</th>
                    <th className="p-3">Finalizado</th>
                  </tr>
                </thead>
                <tbody>
                  {conteos.map((c) => (
                    <tr key={c.id} className="border-b border-navy-800 hover:bg-navy-800/50">
                      <td className="p-3 font-medium">{c.nombre}</td>
                      <td className="p-3">{c.tipo}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          c.estado === 'finalizado' ? 'bg-green-500/20 text-green-400' :
                          c.estado === 'en_progreso' ? 'bg-cyan-500/20 text-cyan-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>
                          {c.estado}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-400">{new Date(c.createdAt).toLocaleDateString('es-AR')}</td>
                      <td className="p-3 text-zinc-400">{c.finalizadoAt ? new Date(c.finalizadoAt).toLocaleDateString('es-AR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-navy-900/50 border border-navy-700 rounded-xl overflow-hidden">
          {movimientos.length === 0 && !cargando ? (
            <p className="p-8 text-center text-zinc-500">No hay movimientos</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-navy-700">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Cant.</th>
                    <th className="p-3">Stock A/D</th>
                    <th className="p-3">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id} className="border-b border-navy-800 hover:bg-navy-800/50">
                      <td className="p-3 text-zinc-400">{new Date(m.createdAt).toLocaleString('es-AR')}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          m.tipo === 'entrada' ? 'bg-green-500/20 text-green-400' :
                          m.tipo === 'salida' ? 'bg-red-500/20 text-red-400' :
                          m.tipo === 'ajuste' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-violet-500/20 text-violet-400'
                        }`}>
                          {m.tipo}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{m.productoId}</td>
                      <td className="p-3">{m.cantidad}</td>
                      <td className="p-3 text-zinc-400">{m.stockAntes} → {m.stockDespues}</td>
                      <td className="p-3 text-zinc-400">{m.motivo || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => cargar(pagina + 1, true)}
            disabled={cargando}
            className="px-6 py-3 bg-navy-800 border border-navy-700 rounded-xl text-zinc-300 hover:bg-navy-700 disabled:opacity-50 transition-colors"
          >
            {cargando ? 'Cargando...' : 'Cargar más'}
          </button>
        </div>
      )}
    </div>
  );
}
