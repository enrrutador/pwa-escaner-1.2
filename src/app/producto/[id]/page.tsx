'use client';

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatMoney } from '@/lib/utils';
import { dbProductos } from '@/lib/db-productos';
import { dbMovimientos } from '@/lib/db-movimientos';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

export default function ProductoDetalle() {
  const params = useParams();
  const id = params.id as string;
  const { usuario, tienePermiso } = useAuthStore();
  const { mostrarToast } = useUIStore();
  const puedeEditar = tienePermiso('productos:editar');
  const puedeAjustar = tienePermiso('stock:ajustar');
  const [producto, setProducto] = useState<any>(null);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    const cargar = async () => {
      const [p, movs] = await Promise.all([
        dbProductos.obtener(id),
        dbMovimientos.listar({ productoId: id, limite: 20 }),
      ]);
      if (!p) {
        notFound();
        return;
      }
      setProducto(p);
      setMovimientos(movs.items);
      setFormData({
        nombre: p.nombre,
        categoria: p.categoria,
        marca: p.marca,
        precioCompra: p.precioCompra,
        precioVenta: p.precioVenta,
        stockMinimo: p.stockMinimo,
        ubicacionId: p.ubicacionId,
      });
      setCargando(false);
    };
    cargar();
  }, [id]);

  const guardar = async () => {
    try {
      await dbProductos.actualizar(id, { ...formData, updatedAt: Date.now() });
      const p = await dbProductos.obtener(id);
      setProducto(p);
      setEditando(false);
      mostrarToast('exito', 'Producto actualizado');
    } catch (e: any) {
      mostrarToast('error', e.message);
    }
  };

  const ajustarStock = async (tipo: 'entrada' | 'salida' | 'ajuste', cantidad: number) => {
    if (!usuario) return;
    try {
      await dbProductos.ajustarStock(id, cantidad, tipo, 'Ajuste manual', usuario.id);
      const p = await dbProductos.obtener(id);
      setProducto(p);
      mostrarToast('exito', `Stock ${tipo}: ${cantidad}`);
    } catch (e: any) {
      mostrarToast('error', e.message);
    }
  };

  if (cargando) return <div className="py-12 text-center text-zinc-500">Cargando...</div>;
  if (!producto) return notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/inventario" className="text-zinc-400 hover:text-zinc-200 text-sm mb-1 block">
            ← Volver al inventario
          </Link>
          <h1 className="text-2xl font-bold">{producto.nombre}</h1>
          <p className="text-zinc-400 text-sm">PLU: {producto.plu} • {producto.codigoBarras || 'Sin código de barras'}</p>
        </div>
        {puedeEditar && (
          <button
            onClick={() => setEditando(!editando)}
            className="px-4 py-2 bg-navy-800 border border-navy-700 rounded-lg hover:bg-navy-700 transition-colors"
          >
            {editando ? 'Cancelar' : 'Editar'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-navy-900/50 border border-navy-700 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-lg">Información</h2>
            {editando ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Nombre"
                  />
                  <input
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Categoría"
                  />
                  <input
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    className="px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Marca"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={formData.precioCompra}
                    onChange={(e) => setFormData({ ...formData, precioCompra: Number(e.target.value) })}
                    className="px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Precio compra"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={formData.precioVenta}
                    onChange={(e) => setFormData({ ...formData, precioVenta: Number(e.target.value) })}
                    className="px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Precio venta"
                  />
                  <input
                    type="number"
                    value={formData.stockMinimo}
                    onChange={(e) => setFormData({ ...formData, stockMinimo: Number(e.target.value) })}
                    className="px-3 py-2 bg-navy-800 border border-navy-700 rounded-lg focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Stock mínimo"
                  />
                </div>
                <button
                  onClick={guardar}
                  className="px-4 py-2 bg-cyan-500 text-navy-950 font-semibold rounded-lg hover:bg-cyan-400"
                >
                  Guardar cambios
                </button>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <dt className="text-zinc-500">Categoría</dt>
                <dd className="font-medium">{producto.categoria}</dd>
                <dt className="text-zinc-500">Marca</dt>
                <dd className="font-medium">{producto.marca || '-'}</dd>
                <dt className="text-zinc-500">Precio compra</dt>
                <dd className="font-medium">{formatMoney(producto.precioCompra)}</dd>
                <dt className="text-zinc-500">Precio venta</dt>
                <dd className="font-medium">{formatMoney(producto.precioVenta)}</dd>
                <dt className="text-zinc-500">Stock mínimo</dt>
                <dd className="font-medium">{producto.stockMinimo}</dd>
                <dt className="text-zinc-500">Ubicación</dt>
                <dd className="font-medium">{producto.ubicacionId || '-'}</dd>
              </dl>
            )}
          </div>

          <div className="bg-navy-900/50 border border-navy-700 rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">Historial de movimientos (últimos 20)</h2>
            {movimientos.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">Sin movimientos</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-navy-700">
                      <th className="pb-2 pr-4">Fecha</th>
                      <th className="pb-2 pr-4">Tipo</th>
                      <th className="pb-2 pr-4">Cantidad</th>
                      <th className="pb-2 pr-4">Stock ant./desp.</th>
                      <th className="pb-2 pr-4">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m) => (
                      <tr key={m.id} className="border-b border-navy-800 last:border-0">
                        <td className="py-2 pr-4 text-zinc-400">
                          {new Date(m.createdAt).toLocaleString('es-AR')}
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            m.tipo === 'entrada' ? 'bg-green-500/20 text-green-400' :
                            m.tipo === 'salida' ? 'bg-red-500/20 text-red-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>{m.tipo}</span>
                        </td>
                        <td className="py-2 pr-4">{m.cantidad}</td>
                        <td className="py-2 pr-4 text-zinc-400">{m.stockAntes} → {m.stockDespues}</td>
                        <td className="py-2 pr-4 text-zinc-400">{m.motivo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-navy-900/50 border border-navy-700 rounded-xl p-6 text-center">
            <p className="text-zinc-500 text-sm">Stock actual</p>
            <p className={`text-5xl font-bold ${producto.stockActual <= producto.stockMinimo ? 'text-orange-400' : 'text-cyan-400'}`}>
              {producto.stockActual}
            </p>
            <p className="text-zinc-500 text-sm mt-1">Mínimo: {producto.stockMinimo}</p>
          </div>

          {puedeAjustar && (
            <div className="bg-navy-900/50 border border-navy-700 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold">Ajuste rápido</h3>
              <div className="grid grid-cols-3 gap-2">
                {['entrada', 'salida', 'ajuste'].map((t) => (
                  <button
                    key={t}
                    onClick={() => ajustarStock(t as any, 1)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      t === 'entrada' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' :
                      t === 'salida' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' :
                      'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                    }`}
                  >
                    {t === 'entrada' ? '+' : t === 'salida' ? '-' : '='} 1
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => ajustarStock('entrada', 5)} className="py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 text-sm">+ 5</button>
                <button onClick={() => ajustarStock('salida', 5)} className="py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm">- 5</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
