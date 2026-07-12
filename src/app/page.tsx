'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/utils';
import { useProductos } from '@/hooks/useProductos';
import { dbAlertas } from '@/lib/db-alertas';
import { dbConteos } from '@/lib/db-conteos';
import { dbEscaneos } from '@/lib/db-escaneos';
import { useAuthStore } from '@/store/authStore';

function StatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  );
}

export default function Dashboard() {
  const { usuario, inicializado } = useAuthStore();
  const { productos, cargando: cargandoProd } = useProductos({ limite: 100 });
  const [alertasNoLeidas, setAlertasNoLeidas] = useState(0);
  const [conteosAbiertos, setConteosAbiertos] = useState(0);
  const [ultimosEscaneos, setUltimosEscaneos] = useState<Array<{ id: string; codigo: string; nombre?: string; imagen?: string | null; productoId?: string | null; createdAt: number }>>([]);

  useEffect(() => {
    if (!inicializado) return;
    dbAlertas.contarNoLeidas().then(setAlertasNoLeidas);
    dbConteos.listar().then((c) => setConteosAbiertos(c.filter((x) => x.estado === 'abierto' || x.estado === 'en_progreso').length));
    dbEscaneos.listar({ limite: 5 }).then(setUltimosEscaneos).catch(() => {});
  }, [inicializado]);

  if (!inicializado) {
    return (
      <div className="screen active">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Panel principal</div>
            <div style={{ height: 32, width: 200, background: 'var(--surface)', borderRadius: 8 }} />
          </div>
          <div style={{ height: 120, background: 'var(--surface)', borderRadius: 'var(--r-2xl)' }} />
          <div className="tile-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ aspectRatio: '1', background: 'var(--surface-low)', borderRadius: 'var(--r-2xl)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalProductos = productos.length;
  const stockBajo = productos.filter((p) => p.stockActual > 0 && p.stockActual <= p.stockMinimo).length;
  const sinStock = productos.filter((p) => p.stockActual === 0).length;
  const enStock = totalProductos - sinStock;

  return (
    <div className="screen active">
      <div>
        <p className="eyebrow">Panel principal</p>
        <h1 className="h-page">Buenas, {usuario?.nombre || 'Usuario'}</h1>
      </div>

      <div className="stat-hero">
        <div className="glow" />
        <div className="row">
          <div>
            <div className="label">Total de artículos</div>
            <div className="value">{totalProductos.toLocaleString('es-AR')}</div>
          </div>
          <div className="badge-icon"><StatIcon /></div>
        </div>
        <div>
          {stockBajo > 0 && (
            <>
              <span className="trend">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                {stockBajo} bajo
              </span>
              <span>stock mínimo</span>
            </>
          )}
        </div>
      </div>

      <div className="tile-grid">
        <button className="tile warn">
          <div className="t-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <div>
            <div className="t-name">Stock bajo</div>
            <div className="t-sub">{stockBajo + sinStock} artículos</div>
          </div>
        </button>
        <Link href="/historial" className="tile blue">
          <div className="t-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
          </div>
          <div>
            <div className="t-name">Dashboard</div>
            <div className="t-sub">Métricas y tendencia</div>
          </div>
        </Link>
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 12 }}>Gestión de datos</p>
        <div className="tile-grid">
          <button className="tile cyan" style={{ aspectRatio: 'auto', padding: 18 }}>
            <div className="t-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            </div>
            <div className="t-name">Importar Excel</div>
          </button>
          <button className="tile cyan" style={{ aspectRatio: 'auto', padding: 18 }}>
            <div className="t-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </div>
            <div className="t-name">Exportar Excel</div>
          </button>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="section-title">Últimos escaneos</h3>
          <Link href="/inventario" className="link">Ver todo</Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ultimosEscaneos.length === 0 ? (
            <div className="empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>
              <p>Escaneá productos para ver el historial</p>
            </div>
          ) : (
            ultimosEscaneos.map((e) => (
              <Link
                key={e.id}
                href={e.productoId ? `/producto/${e.productoId}` : `/inventario/nuevo?cod=${e.codigo}&nom=${encodeURIComponent(e.nombre || '')}&img=${e.imagen || ''}`}
                className="scan-row"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="thumb">
                  {e.imagen ? (
                    <img src={e.imagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff', borderRadius: 'var(--r-lg)' }} />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="10" x="7" y="7" rx="1"/></svg>
                  )}
                </div>
                <div className="info">
                  <div className="name">{e.nombre || e.codigo}</div>
                  <div className="time">{new Date(e.createdAt).toLocaleDateString('es-AR')}</div>
                </div>
                <div className="sku">#{e.codigo}</div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
