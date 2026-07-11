'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { dbProductos } from '@/lib/db-productos';

export default function NuevoProducto() {
  const router = useRouter();
  const { tienePermiso } = useAuthStore();
  const { mostrarToast } = useUIStore();
  const [cargando, setCargando] = useState(false);

  if (!tienePermiso('productos:crear')) return <div className="p-8 text-center text-red-400">Sin permisos</div>;

  const [form, setForm] = useState({
    plu: '',
    codigoBarras: '',
    nombre: '',
    categoria: 'General',
    marca: '',
    precioCompra: 0,
    precioVenta: 0,
    stockActual: 0,
    stockMinimo: 5,
    ubicacionId: null as string | null,
  });

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.codigoBarras) {
      mostrarToast('error', 'Nombre y código de barras son obligatorios');
      return;
    }
    setCargando(true);
    try {
      await dbProductos.crear(form);
      mostrarToast('exito', 'Producto creado');
      router.push('/inventario');
    } catch (e: any) {
      mostrarToast('error', e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <form onSubmit={crear} className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Nuevo producto</h1>
        <p className="text-zinc-400 text-sm">Completá los datos del producto</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm text-zinc-400 mb-1">Nombre *</label>
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: Leche Entera 1L"
            className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">PLU</label>
          <input
            value={form.plu}
            onChange={(e) => setForm({ ...form, plu: e.target.value })}
            placeholder="Ej: 0001"
            className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Código de barras *</label>
          <input
            value={form.codigoBarras}
            onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })}
            placeholder="Ej: 7790070001234"
            className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Categoría</label>
          <input
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            placeholder="Ej: Lácteos"
            className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Marca</label>
          <input
            value={form.marca}
            onChange={(e) => setForm({ ...form, marca: e.target.value })}
            placeholder="Ej: La Serenísima"
            className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Precio compra</label>
          <input
            type="number"
            step="0.01"
            value={form.precioCompra}
            onChange={(e) => setForm({ ...form, precioCompra: Number(e.target.value) })}
            className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Precio venta</label>
          <input
            type="number"
            step="0.01"
            value={form.precioVenta}
            onChange={(e) => setForm({ ...form, precioVenta: Number(e.target.value) })}
            className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Stock actual</label>
          <input
            type="number"
            value={form.stockActual}
            onChange={(e) => setForm({ ...form, stockActual: Number(e.target.value) })}
            className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Stock mínimo</label>
          <input
            type="number"
            value={form.stockMinimo}
            onChange={(e) => setForm({ ...form, stockMinimo: Number(e.target.value) })}
            className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button type="button" onClick={() => router.back()} className="flex-1 px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-zinc-300 hover:bg-navy-700">
          Cancelar
        </button>
        <button type="submit" disabled={cargando} className="flex-1 px-4 py-3 bg-cyan-500 text-navy-950 font-semibold rounded-xl hover:bg-cyan-400 disabled:opacity-50">
          {cargando ? 'Creando...' : 'Crear producto'}
        </button>
      </div>
    </form>
  );
}
