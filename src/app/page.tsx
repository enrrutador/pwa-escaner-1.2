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
import { exportProductosToExcel, generateTemplateExcel, importProductosFromFile } from '@/lib/excel';

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

  const handleExport = () => {
    exportProductosToExcel(productos);
    mostrarToast('exito', 'Exportación completada');
  };

  const handleTemplate = () => {
    generateTemplateExcel();
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
                    <img src={e.imagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff', borderRadius: 'var(--r-lg)' }} />
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
