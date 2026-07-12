'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/utils';
import { useProductos } from '@/hooks/useProductos';

const CATEGORIAS = ['Todas'];

function ProductIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  );
}

export default function Inventario() {
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');
  const { productos, total, hasMore, cargando, error, cargarMas } = useProductos({
    busqueda,
    limite: 50,
  });

  const categoriasUnicas = ['Todas', ...new Set(productos.map((p) => p.categoria).filter(Boolean))];
  const categorias = categoriasUnicas.length > 1 ? categoriasUnicas : CATEGORIAS;

  const productosFiltrados = categoriaActiva === 'Todas'
    ? productos
    : productos.filter((p) => p.categoria === categoriaActiva);

  function getStockStatus(p: { stockActual: number; stockMinimo: number }) {
    if (p.stockActual === 0) return { cls: 'out', label: 'Sin stock' };
    if (p.stockActual <= p.stockMinimo) return { cls: 'low', label: 'Stock bajo' };
    return { cls: 'ok', label: `${p.stockActual} ok` };
  }

  return (
    <div className="screen active">
      <div>
        <p className="eyebrow">Inventario</p>
        <h1 className="h-page">Productos</h1>
      </div>

      <div className="search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          type="text"
          placeholder="Buscar SKU, nombre, código…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="chips no-sb">
        {categorias.map((c) => (
          <button
            key={c}
            className={`chip${categoriaActiva === c ? ' active' : ''}`}
            onClick={() => setCategoriaActiva(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="count-line">
        {productosFiltrados.length} productos
      </div>

      {error && (
        <div style={{ padding: 16, background: 'oklch(72% 0.14 25 / .16)', border: '1px solid var(--danger)', borderRadius: 'var(--r-xl)', color: 'var(--danger)' }}>
          Error: {error.message}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {productosFiltrados.length === 0 && !cargando ? (
          <div className="empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="m8 8 6 6"/></svg>
            <p>Sin resultados</p>
          </div>
        ) : (
          productosFiltrados.map((p) => {
            const st = getStockStatus(p);
            return (
              <Link key={p.id} href={`/producto/${p.id}`} className={`product${st.cls === 'out' ? ' out' : ''}`}>
                <div className="pimg">
                  <ProductIcon />
                </div>
                <div className="pbody">
                  <div className="prow">
                    <div className="pname">{p.nombre}</div>
                    <span className={`pill ${st.cls}`}>
                      {st.cls === 'ok' ? `${p.stockActual} und` : st.label}
                    </span>
                  </div>
                  <div className="pmeta">
                    PLU: {p.plu || '—'}
                    <span className="dot" />
                    {p.codigoBarras || '—'}
                  </div>
                  <div className="pstats">
                    <div>
                      <div className="k">Cantidad</div>
                      <div className="v">{p.stockActual} und.</div>
                    </div>
                    <div>
                      <div className="k">Precio</div>
                      <div className="v">{formatMoney(p.precioVenta)}</div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {hasMore && (
        <button
          onClick={cargarMas}
          disabled={cargando}
          style={{
            width: '100%', padding: '12px', background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-xl)', color: 'var(--text-dim)', fontWeight: 600, cursor: 'pointer',
            opacity: cargando ? 0.5 : 1,
          }}
        >
          {cargando ? 'Cargando...' : 'Cargar más'}
        </button>
      )}
    </div>
  );
}
