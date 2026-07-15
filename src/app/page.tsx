'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/utils';
import { useProductos } from '@/hooks/useProductos';
import { dbAlertas } from '@/lib/db-alertas';
import { dbConteos } from '@/lib/db-conteos';
import { dbEscaneos } from '@/lib/db-escaneos';
import { dbProductos } from '@/lib/db-productos';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

function StatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  );
}

function DownloadIcon({ style }: { style?: React.CSSProperties }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;
}

function UploadIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>;
}

function FileIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>;
}

function XIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

function CheckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}

function SearchIcon({ style }: { style?: React.CSSProperties }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
}

function PulseRing() {
  return (
    <span
      style={{
        position: 'absolute',
        inset: -4,
        borderRadius: '50%',
        border: '2px solid var(--primary)',
        animation: 'pulse-ring 2s ease-out infinite',
        pointerEvents: 'none',
      }}
    />
  );
}

export default function Dashboard() {
  const { usuario, inicializado } = useAuthStore();
  const { mostrarToast } = useUIStore();
  const router = useRouter();
  const { productos, cargando: cargandoProd } = useProductos({ limite: 100 });
  const [alertasNoLeidas, setAlertasNoLeidas] = useState(0);
  const [conteosAbiertos, setConteosAbiertos] = useState(0);
  const [ultimosEscaneos, setUltimosEscaneos] = useState<Array<{ id: string; codigo: string; nombreProducto?: string; imagen?: string | null; productoId?: string | null; createdAt: number }>>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ productos: any[]; errors: any[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [buscadorOpen, setBuscadorOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);

  const abrirEscaneo = async (e: { id: string; codigo: string; productoId?: string | null }) => {
    if (e.productoId) {
      router.push(`/producto/${e.productoId}/editar`);
      return;
    }
    const producto = await dbProductos.obtenerPorCodigoBarras(e.codigo);
    if (producto) {
      router.push(`/producto/${producto.id}/editar`);
    } else {
      router.push(`/inventario/nuevo?cod=${encodeURIComponent(e.codigo)}`);
    }
  };

  useEffect(() => {
    if (!inicializado) return;
    dbAlertas.contarNoLeidas().then(setAlertasNoLeidas);
    dbConteos.listar().then((c) => setConteosAbiertos(c.filter((x) => x.estado === 'abierto' || x.estado === 'en_progreso').length));
    dbEscaneos.listar({ limite: 5 }).then((escaneos) => setUltimosEscaneos(escaneos as any)).catch(() => {});
  }, [inicializado]);

  // Búsqueda predictiva con debounce
  useEffect(() => {
    if (!buscadorOpen || !busqueda.trim()) {
      setResultados([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setBuscando(true);
      try {
        // 1. Buscar en DB local
        const res = await dbProductos.listar({ busqueda: busqueda.trim(), limite: 20 });
        
        if (res.items.length > 0) {
          setResultados(res.items);
        } else {
          // 2. Si no hay resultados, buscar en APIs externas (scraping)
          const apiRes = await fetch(`/api/buscar?q=${encodeURIComponent(busqueda.trim())}`);
          const apiData = await apiRes.json();
          const externos = apiData.resultados || [];
          
          // Transformar resultados externos al formato local
          const transformed = externos.map((p: any) => ({
            id: `ext-${p.codigoBarras || Date.now()}`,
            nombre: p.nombre || 'Sin nombre',
            descripcion: p.descripcion || '',
            plu: '',
            codigoBarras: p.codigoBarras || '',
            categoria: p.categoria || 'General',
            marca: p.marca || '',
            precioVenta: p.precio || 0,
            stockActual: 0,
            stockMinimo: 0,
            imagen: p.imagen || null,
            _externo: true,
          }));
          setResultados(transformed);
        }
      } catch (err) {
        console.error('Error buscando:', err);
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [busqueda, buscadorOpen]);

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

  const handleExport = async () => {
    const { exportProductosToExcel } = await import('@/lib/excel');
    await exportProductosToExcel(productos);
    mostrarToast('exito', 'Exportación completada');
  };

  const handleTemplate = async () => {
    const { generateTemplateExcel } = await import('@/lib/excel');
    await generateTemplateExcel();
    mostrarToast('info', 'Plantilla descargada');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      mostrarToast('error', 'Solo archivos .xlsx o .xls');
      return;
    }
    setImportFile(file);
    setImportPreview(null);
    previewImport(file);
  };

  const previewImport = async (file: File) => {
    try {
      const { importProductosFromFile } = await import('@/lib/excel');
      const result = await importProductosFromFile(file);
      setImportPreview(result);
    } catch (err: any) {
      mostrarToast('error', 'Error leyendo archivo: ' + err.message);
    }
  };

  const confirmImport = async () => {
    if (!importPreview || importPreview.productos.length === 0) return;
    setImportLoading(true);
    try {
      for (const p of importPreview.productos) {
        await dbProductos.crear(p);
      }
      mostrarToast('exito', `${importPreview.productos.length} productos importados`);
      setImportModalOpen(false);
      setImportFile(null);
      setImportPreview(null);
      router.refresh();
    } catch (err: any) {
      mostrarToast('error', 'Error importando: ' + err.message);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="screen active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">Panel principal</p>
          <h1 className="h-page">Buenas, {usuario?.nombre || 'Usuario'}</h1>
        </div>
        <button
          className="icon-btn"
          onClick={() => { setBuscadorOpen(true); setBusqueda(''); setResultados([]); }}
          title="Buscar producto por nombre"
          style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--r-full)',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-strong) 100%)',
            boxShadow: '0 4px 16px var(--primary)/40, 0 0 0 4px var(--primary)/20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'visible',
            transition: 'transform .2s var(--ease), box-shadow .2s var(--ease)',
            zIndex: 10,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px var(--primary)/50, 0 0 0 6px var(--primary)/25'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px var(--primary)/40, 0 0 0 4px var(--primary)/20'; }}
        >
          <PulseRing />
          <SearchIcon style={{ color: 'var(--on-primary)', width: 24, height: 24, zIndex: 1 }} />
        </button>
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
        <button className="tile warn" onClick={() => router.push('/inventario?filter=stock-bajo')}>
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
          <button className="tile cyan" style={{ aspectRatio: 'auto', padding: 18 }} onClick={() => { setImportModalOpen(true); setImportFile(null); setImportPreview(null); }}>
            <div className="t-icon"><UploadIcon /></div>
            <div className="t-name">Importar Excel</div>
          </button>
          <button className="tile cyan" style={{ aspectRatio: 'auto', padding: 18 }} onClick={handleExport}>
            <div className="t-icon"><DownloadIcon /></div>
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
              <button
                key={e.id}
                onClick={() => abrirEscaneo(e)}
                className="scan-row"
                style={{ textDecoration: 'none', color: 'inherit', width: '100%', textAlign: 'left' }}
              >
                <div className="thumb">
                  {e.imagen ? (
                    <img 
                      src={e.imagen} 
                      alt="" 
                      loading="lazy"
                      width={50}
                      height={50}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff', borderRadius: 'var(--r-lg)' }} 
                    />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="10" x="7" y="7" rx="1"/></svg>
                  )}
                </div>
                <div className="info">
                  <div className="name">{e.nombreProducto || e.codigo}</div>
                  <div className="time">
                    {new Date(e.createdAt).toLocaleDateString('es-AR')} · {new Date(e.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="sku">#{e.codigo}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Buscador Modal */}
      {buscadorOpen && (
        <div className="modal-overlay" onClick={() => { setBuscadorOpen(false); setBusqueda(''); setResultados([]); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>Buscar producto por nombre</h2>
              <button className="modal-close" onClick={() => { setBuscadorOpen(false); setBusqueda(''); setResultados([]); }}><XIcon /></button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <div style={{ padding: 16, borderBottom: '1px solid var(--line-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '10px 14px', border: '1px solid var(--line-soft)' }}>
                  <SearchIcon />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Escribí el nombre del producto..."
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '1rem', color: 'var(--text)' }}
                    autoFocus
                  />
                  {busqueda && (
                    <button onClick={() => { setBusqueda(''); setResultados([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }}>
                      <XIcon />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                {buscando && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-faint)' }}>
                    Buscando...
                  </div>
                )}
                {!buscando && busqueda.trim() && resultados.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-faint)', marginBottom: 8 }}>No se encontraron productos</div>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        setBuscadorOpen(false);
                        router.push(`/inventario/nuevo?nom=${encodeURIComponent(busqueda.trim())}`);
                      }}
                    >
                      Crear producto "{busqueda.trim()}"
                    </button>
                  </div>
                )}
{!buscando && resultados.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {resultados.map((p) => {
                      const isExternal = p._externo === true;
                      const externalParams = new URLSearchParams({
                        nom: p.nombre || '',
                        cod: p.codigoBarras || '',
                        img: p.imagen || '',
                        des: p.descripcion || '',
                        mar: p.marca || '',
                        pre: String(p.precioVenta || ''),
                        cat: p.categoria || '',
                      }).toString();
                      
                      const externalHref = `/inventario/nuevo?${externalParams}`;
                      const localHref = `/producto/${p.id}/editar`;
                      const href = isExternal ? externalHref : localHref;
                      
                      return (
                        <Link
                          key={p.id}
                          href={href}
                          onClick={() => setBuscadorOpen(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--line-soft)',
                            textDecoration: 'none',
                            color: 'inherit',
                            transition: 'background .15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-high)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ width: 48, height: 48, borderRadius: 'var(--r-lg)', background: 'var(--surface)', display: 'grid', placeItems: 'center', flexShrink: 0, border: '1px solid var(--line-soft)' }}>
                            {p.imagen ? (
                              <img src={p.imagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'var(--r-lg)' }} />
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-faint)' }}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '.9rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.nombre}
                              {isExternal && <span style={{ marginLeft: 8, fontSize: '.65rem', background: 'var(--primary)', color: 'var(--on-primary)', padding: '2px 6px', borderRadius: 'var(--r-full)', fontWeight: 700 }}>WEB</span>}
                            </div>
                            <div style={{ fontSize: '.75rem', color: 'var(--text-faint)' }}>
                              PLU: {p.plu || '—'} · {p.codigoBarras || '—'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--cyan)' }}>{formatMoney(p.precioVenta)}</div>
                            <div style={{ fontSize: '.72rem', color: p.stockActual <= p.stockMinimo ? 'var(--warn)' : 'var(--text-faint)' }}>
                              {p.stockActual} und
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {!busqueda.trim() && (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>
                    <SearchIcon />
                    <p style={{ marginTop: 8, fontSize: '.9rem' }}>Empezá a escribir para buscar productos</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <div className="modal-overlay" onClick={() => { setImportModalOpen(false); setImportFile(null); setImportPreview(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Importar productos desde Excel</h2>
              <button className="modal-close" onClick={() => { setImportModalOpen(false); setImportFile(null); setImportPreview(null); }}><XIcon /></button>
            </div>
            <div className="modal-body">
              {!importFile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', padding: 20 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 'var(--r-full)', background: 'var(--surface-low)', display: 'grid', placeItems: 'center', color: 'var(--text-faint)' }}><FileIcon /></div>
                  <p style={{ color: 'var(--text-dim)', textAlign: 'center' }}>Arrastrá un archivo .xlsx o hacé clic para seleccionar</p>
                  <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} style={{ display: 'none' }} id="import-file" />
                  <label htmlFor="import-file" className="btn-primary" style={{ cursor: 'pointer' }}><DownloadIcon style={{ width: 18, height: 18, marginRight: 8 }} />Seleccionar archivo</label>
                  <button className="btn-ghost" onClick={handleTemplate} style={{ marginTop: 8 }}>Descargar plantilla</button>
                </div>
              ) : importPreview ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="import-summary">
                    <div className={`summary-item ${importPreview.errors.length > 0 ? 'warn' : 'ok'}`}>
                      <span>{importPreview.productos.length} productos válidos</span>
                    </div>
                    {importPreview.errors.length > 0 && (
                      <div className="summary-item error">
                        <span>{importPreview.errors.length} errores</span>
                      </div>
                    )}
                  </div>
                  {importPreview.errors.length > 0 && (
                    <details className="errors-list">
                      <summary>Ver errores ({importPreview.errors.length})</summary>
                      <ul>
                        {importPreview.errors.map((err, i) => (
                          <li key={i}>Fila {err.row}: {err.message}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <div className="import-preview-table">
                    <table>
                      <thead>
                        <tr>
                          <th>PLU</th>
                          <th>Código barras</th>
                          <th>Nombre</th>
                          <th>Categoría</th>
                          <th>Marca</th>
                          <th>P. venta</th>
                          <th>Stock</th>
                          <th>Mín</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.productos.slice(0, 20).map((p, i) => (
                          <tr key={i}>
                            <td>{p.plu || '—'}</td>
                            <td>{p.codigoBarras || '—'}</td>
                            <td>{p.nombre}</td>
                            <td>{p.categoria}</td>
                            <td>{p.marca || '—'}</td>
                            <td>{formatMoney(p.precioVenta)}</td>
                            <td>{p.stockActual}</td>
                            <td>{p.stockMinimo}</td>
                          </tr>
                        ))}
                        {importPreview.productos.length > 20 && (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>... y {importPreview.productos.length - 20} más</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
            {importPreview && importPreview.productos.length > 0 && (
              <div className="modal-footer">
                <button className="btn-ghost" onClick={() => { setImportFile(null); setImportPreview(null); }}>Cambiar archivo</button>
                <button className="btn-primary" onClick={confirmImport} disabled={importLoading || importPreview.productos.length === 0}>
                  {importLoading ? 'Importando...' : `Importar ${importPreview.productos.length} productos`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
