'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatMoney } from '@/lib/utils';
import { dbProductos } from '@/lib/db-productos';
import { dbMovimientos } from '@/lib/db-movimientos';
import { useAuthStore } from '@/store/authStore';

export default function ProductoDetalle() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { usuario } = useAuthStore();
  const [producto, setProducto] = useState<any>(null);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const [p, movs] = await Promise.all([
        dbProductos.obtener(id),
        dbMovimientos.listar({ productoId: id, limite: 20 }),
      ]);
      if (!p) { router.push('/inventario'); return; }
      setProducto(p);
      setMovimientos(movs.items);
      setCargando(false);
    };
    cargar();
  }, [id, router]);

  const ajustarStock = async (tipo: 'entrada' | 'salida', cantidad: number) => {
    if (!usuario) return;
    await dbProductos.ajustarStock(id, cantidad, tipo, 'Ajuste manual', usuario.id);
    const p = await dbProductos.obtener(id);
    setProducto(p);
  };

  if (cargando) {
    return (
      <div className="screen active">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ height: 190, background: 'var(--surface)', borderRadius: 'var(--r-2xl)' }} />
          <div style={{ height: 40, width: 200, background: 'var(--surface)', borderRadius: 8 }} />
          <div className="attr-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 60, background: 'var(--surface)', borderRadius: 'var(--r-lg)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!producto) return null;

  const stockStatus = producto.stockActual === 0 ? 'Sin stock' :
    producto.stockActual <= producto.stockMinimo ? 'Stock bajo' : `En stock: ${producto.stockActual}`;

  return (
    <div className="screen active">
      <Link href="/inventario" className="crumb">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        Volver al inventario
      </Link>

      <div className="detail-hero">
        <div className="shine" />
        <svg className="big-ic" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
          <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
        </svg>
      </div>

      <div className="detail-head">
        <div>
          <h2>{producto.nombre}</h2>
          <div className="plu">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="10" x="7" y="7" rx="1"/></svg>
            PLU: {producto.plu || '—'}
          </div>
        </div>
        <div className="stock-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
          {stockStatus}
        </div>
      </div>

      <div className="attr-grid">
        <div className="attr"><span className="k">Marca</span><span className="v">{producto.marca || '—'}</span></div>
        <div className="attr"><span className="k">Categoría</span><span className="v">{producto.categoria || '—'}</span></div>
        <div className="attr"><span className="k">Precio compra</span><span className="v">{formatMoney(producto.precioCompra)}</span></div>
        <div className="attr"><span className="k">Precio venta</span><span className="v money">{formatMoney(producto.precioVenta)}</span></div>
        <div className="attr"><span className="k">Stock mínimo</span><span className="v warn">{producto.stockMinimo} uds</span></div>
        <div className="attr"><span className="k">Ubicación</span><span className="v">{producto.ubicacionId || '—'}</span></div>
      </div>

      <div className="adjust">
        <button className="in" onClick={() => ajustarStock('entrada', 1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
          Entrada
        </button>
        <button className="out" onClick={() => ajustarStock('salida', 1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
          Salida
        </button>
      </div>

      {movimientos.length > 0 && (
        <div className="panel">
          <div className="p-head">
            <h2>Movimientos recientes</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {movimientos.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-high)', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)' }}>
                <span style={{ fontSize: '.85rem', color: 'var(--text-dim)' }}>{m.tipo}</span>
                <span style={{ fontSize: '.85rem', fontWeight: 600 }}>{m.cantidad}</span>
                <span style={{ fontSize: '.78rem', color: 'var(--text-faint)' }}>{new Date(m.createdAt).toLocaleDateString('es-AR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
