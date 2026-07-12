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

  if (!tienePermiso('productos:crear')) {
    return (
      <div className="screen active">
        <div className="empty">
          <p>Sin permisos para crear productos</p>
        </div>
      </div>
    );
  }

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
    if (!form.nombre) {
      mostrarToast('error', 'El nombre es obligatorio');
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
    <div className="screen active">
      <div>
        <p className="eyebrow">Inventario</p>
        <h1 className="h-page">Nuevo producto</h1>
      </div>

      <form onSubmit={crear} className="form-panel">
        <div className="fp-head">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <h2>Datos del producto</h2>
        </div>
        <div className="fgrid">
          <div className="field">
            <label>EAN</label>
            <input type="text" value={form.codigoBarras} onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })} placeholder="Ej. 8431057002018" />
          </div>
          <div className="field">
            <label>PLU (interno)</label>
            <input type="text" value={form.plu} onChange={(e) => setForm({ ...form, plu: e.target.value })} placeholder="Ej. 1045" />
          </div>
          <div className="field full">
            <label>Nombre <span className="req">*</span></label>
            <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required placeholder="Nombre del producto" />
          </div>
          <div className="field">
            <label>Marca</label>
            <input type="text" value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} placeholder="Marca" />
          </div>
          <div className="field">
            <label>Categoría</label>
            <input type="text" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Categoría" />
          </div>
          <div className="field">
            <label>Precio compra</label>
            <input type="number" step="0.01" value={form.precioCompra || ''} onChange={(e) => setForm({ ...form, precioCompra: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Precio venta</label>
            <input type="number" step="0.01" value={form.precioVenta || ''} onChange={(e) => setForm({ ...form, precioVenta: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Stock actual</label>
            <input type="number" value={form.stockActual} onChange={(e) => setForm({ ...form, stockActual: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Stock mínimo</label>
            <input type="number" value={form.stockMinimo} onChange={(e) => setForm({ ...form, stockMinimo: Number(e.target.value) })} />
          </div>
          <div className="field full" style={{ gap: 10, marginTop: 4 }}>
            <button type="submit" className="btn-primary" disabled={cargando}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              {cargando ? 'Guardando...' : 'Guardar producto'}
            </button>
            <button type="button" onClick={() => router.back()} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
