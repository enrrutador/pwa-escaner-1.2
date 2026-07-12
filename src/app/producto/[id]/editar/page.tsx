'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { dbProductos } from '@/lib/db-productos';
import type { Producto } from '@/types';

function stripHtml(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function EditarProductoInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { tienePermiso } = useAuthStore();
  const { mostrarToast } = useUIStore();
  const [cargando, setCargando] = useState(false);
  const [producto, setProducto] = useState<Producto | null>(null);

  const id = params.id as string;
  const esNuevo = id === 'nuevo';

  // Pre-fill from URL params (scraped data) - solo para productos nuevos
  const initCodigo = searchParams.get('cod') || '';
  const initNombre = searchParams.get('nom') || '';
  const initImg = searchParams.get('img') || '';
  const initDesc = searchParams.get('des') || '';
  const initPre = searchParams.get('pre') || '';
  const initMarca = searchParams.get('mar') || '';

  if (!tienePermiso('productos:editar') && !esNuevo) {
    return (
      <div className="screen active">
        <div className="empty">
          <p>Sin permisos para editar productos</p>
        </div>
      </div>
    );
  }

  const [form, setForm] = useState({
    plu: '',
    codigoBarras: initCodigo,
    nombre: initNombre,
    categoria: 'General',
    marca: initMarca,
    precioCompra: 0,
    precioVenta: initPre ? Number(initPre) : 0,
    stockActual: 0,
    stockMinimo: 5,
    ubicacionId: null as string | null,
    imagen: initImg,
    descripcion: initDesc ? stripHtml(initDesc) : '',
  });

  useEffect(() => {
    if (!esNuevo && id) {
      dbProductos.obtener(id).then((p) => {
        if (p) {
          setProducto(p);
          setForm({
            plu: p.plu || '',
            codigoBarras: p.codigoBarras || '',
            nombre: p.nombre,
            categoria: p.categoria || 'General',
            marca: p.marca || '',
            precioCompra: p.precioCompra || 0,
            precioVenta: p.precioVenta || 0,
            stockActual: p.stockActual || 0,
            stockMinimo: p.stockMinimo || 5,
            ubicacionId: p.ubicacionId || null,
            imagen: p.imagen || '',
            descripcion: p.descripcion || '',
          });
        } else {
          mostrarToast('error', 'Producto no encontrado');
          router.push('/inventario');
        }
      });
    }
  }, [id, esNuevo, router, mostrarToast]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre) {
      mostrarToast('error', 'El nombre es obligatorio');
      return;
    }
    setCargando(true);
    try {
      if (esNuevo || !producto) {
        await dbProductos.crear({
          plu: form.plu,
          codigoBarras: form.codigoBarras,
          nombre: form.nombre,
          categoria: form.categoria,
          marca: form.marca,
          precioCompra: form.precioCompra,
          precioVenta: form.precioVenta,
          stockActual: form.stockActual,
          stockMinimo: form.stockMinimo,
          ubicacionId: form.ubicacionId,
          imagen: form.imagen || undefined,
          descripcion: form.descripcion || undefined,
        });
        mostrarToast('exito', 'Producto creado');
      } else {
        await dbProductos.actualizar(producto.id, {
          plu: form.plu,
          codigoBarras: form.codigoBarras,
          nombre: form.nombre,
          categoria: form.categoria,
          marca: form.marca,
          precioCompra: form.precioCompra,
          precioVenta: form.precioVenta,
          stockActual: form.stockActual,
          stockMinimo: form.stockMinimo,
          ubicacionId: form.ubicacionId,
          imagen: form.imagen || undefined,
          descripcion: form.descripcion || undefined,
        });
        mostrarToast('exito', 'Producto actualizado');
      }
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
        <h1 className="h-page">{esNuevo || !producto ? 'Nuevo producto' : 'Editar producto'}</h1>
      </div>

      {form.imagen && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <img 
            src={form.imagen} 
            alt={form.nombre || 'Producto'}
            style={{ 
              width: 120, 
              height: 120, 
              borderRadius: 'var(--r-xl)', 
              objectFit: 'contain',
              background: '#fff',
              border: '2px solid var(--line-soft)'
            }}
          />
        </div>
      )}

      <form onSubmit={guardar} className="form-panel">
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
          <div className="field full">
            <label>Descripción</label>
            <textarea 
              value={form.descripcion} 
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Descripción del producto"
              rows={3}
              style={{ resize: 'vertical', minHeight: 60 }}
            />
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
              {cargando ? 'Guardando...' : (esNuevo || !producto ? 'Guardar producto' : 'Actualizar producto')}
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

export default function EditarProducto() {
  return (
    <Suspense fallback={<div className="screen active"><div className="empty"><p>Cargando...</p></div></div>}>
      <EditarProductoInner />
    </Suspense>
  );
}