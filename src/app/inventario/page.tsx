'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/utils';
import { useProductos } from '@/hooks/useProductos';
import { useAuthStore } from '@/store/authStore';
import { dbProductos } from '@/lib/db-productos';

export default function Inventario() {
  const { tienePermiso } = useAuthStore();
  const puedeCrear = tienePermiso('productos:crear');
  const [busqueda, setBusqueda] = useState('');
  const { productos, total, hasMore, cargando, error, cargarMas, recargar } = useProductos({
    busqueda,
    limite: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-zinc-400 text-sm">{total} productos</p>
        </div>
        {puedeCrear && (
          <Link
            href="/inventario/nuevo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-navy-950 font-semibold rounded-lg hover:bg-cyan-400 transition-colors"
          >
            + Nuevo producto
          </Link>
        )}
      </div>

      <div className="relative">
        <input
          type="search"
          placeholder="Buscar por nombre, PLU o código de barras..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400">
          Error: {error.message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-navy-700">
              <th className="pb-2 pr-4">PLU</th>
              <th className="pb-2 pr-4">Código barras</th>
              <th className="pb-2 pr-4">Producto</th>
              <th className="pb-2 pr-4">Categoría</th>
              <th className="pb-2 pr-4">Stock</th>
              <th className="pb-2 pr-4">Precio</th>
              <th className="pb-2 pr-4">Estado</th>
            </tr>
          </thead>
          <tbody>
            {productos.length === 0 && !cargando ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-500">
                  No hay productos. {puedeCrear ? 'Crea uno nuevo.' : 'Contacta al admin.'}
                </td>
              </tr>
            ) : (
              productos.map((p) => (
                <tr key={p.id} className="border-b border-navy-800 last:border-0 hover:bg-navy-800/50">
                  <td className="py-3 pr-4 font-mono text-cyan-400">{p.plu}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-zinc-400">{p.codigoBarras || '-'}</td>
                  <td className="py-3 pr-4">
                    <Link href={`/producto/${p.id}`} className="hover:text-cyan-400 transition-colors font-medium">
                      {p.nombre}
                    </Link>
                    {p.marca && <span className="text-zinc-500 text-xs ml-1">({p.marca})</span>}
                  </td>
                  <td className="py-3 pr-4 text-zinc-400">{p.categoria}</td>
                  <td className="py-3 pr-4">
                    <span className={p.stockActual <= p.stockMinimo ? 'text-orange-400 font-semibold' : ''}>
                      {p.stockActual}
                    </span>
                    <span className="text-zinc-500 text-xs ml-1">/ {p.stockMinimo}</span>
                  </td>
                  <td className="py-3 pr-4">{formatMoney(p.precioVenta)}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      p.activo ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="text-center">
          <button
            onClick={cargarMas}
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
