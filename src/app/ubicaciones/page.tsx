'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { dbUbicaciones } from '@/lib/db-ubicaciones';
import { dbProductos } from '@/lib/db-productos';
import { formatMoney } from '@/lib/utils';
import type { Ubicacion, TipoUbicacion, Producto } from '@/types';
import { uid, now } from '@/lib/utils';

const TIPOS_SALON: { value: TipoUbicacion; label: string }[] = [
  { value: 'sucursal', label: 'Sucursal' },
  { value: 'pasillo', label: 'Pasillo' },
  { value: 'gondola', label: 'Góndola' },
  { value: 'estante', label: 'Estante' },
  { value: 'posicion', label: 'Posición' },
];

const TIPOS_DEPOSITO: { value: TipoUbicacion; label: string }[] = [
  { value: 'deposito', label: 'Depósito' },
  { value: 'pasillo', label: 'Pasillo' },
  { value: 'estante', label: 'Estante' },
  { value: 'posicion', label: 'Posición' },
];

function IconBtn({ onClick, children, title, className = '' }: {
  onClick: (e: any) => void;
  children: React.ReactNode;
  title: string;
  className?: string;
}) {
  return (
    <button className={`icon-btn ${className}`} onClick={onClick} title={title} style={{ width: 32, height: 32 }}>
      {children}
    </button>
  );
}

function UbicacionTree({
  ubicaciones,
  selectedId,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  filterTipo,
  productCounts,
}: {
  ubicaciones: Ubicacion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (parentId: string | null, tipo: TipoUbicacion) => void;
  onEdit: (u: Ubicacion) => void;
  onDelete: (id: string) => void;
  filterTipo: TipoUbicacion[];
  productCounts: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const renderNode = (u: Ubicacion, depth: number) => {
    if (filterTipo.length && !filterTipo.includes(u.tipo)) return null;
    const hasChildren = ubicaciones.some(x => x.parentId === u.id);
    const isExpanded = expanded.has(u.id);

    return (
      <div key={u.id} style={{ paddingLeft: depth * 16 }}>
        <div
          className={`tree-node${selectedId === u.id ? ' selected' : ''}`}
          onClick={() => onSelect(u.id)}
        >
          {hasChildren ? (
            <button
              onClick={e => {
                e.stopPropagation();
                setExpanded(prev => {
                  const n = new Set(prev);
                  isExpanded ? n.delete(u.id) : n.add(u.id);
                  return n;
                });
              }}
              className="tree-toggle"
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="tree-spacer" />
          )}
          <span className="tree-name">{u.nombre}</span>
          {productCounts[u.id] ? (
            <span className="tree-count">{productCounts[u.id]}</span>
          ) : null}
          <span className="badge">{u.tipo}</span>
          <div className="tree-actions">
            <IconBtn
              onClick={e => {
                e.stopPropagation();
                onCreate(u.id, u.tipo === 'sucursal' || u.tipo === 'deposito' ? 'pasillo' : 'posicion');
              }}
              title="Añadir hijo"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            </IconBtn>
            <IconBtn onClick={e => { e.stopPropagation(); onEdit(u); }} title="Editar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </IconBtn>
            <IconBtn
              onClick={e => {
                e.stopPropagation();
                if (confirm('Eliminar esta ubicación y sus hijos?')) onDelete(u.id);
              }}
              title="Eliminar"
              className="danger"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </IconBtn>
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div>{ubicaciones.filter(x => x.parentId === u.id).map(c => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="ubicacion-tree">
      {ubicaciones.filter(u => !u.parentId).map(u => renderNode(u, 0))}
    </div>
  );
}

export default function UbicacionesPage() {
  return (
    <Suspense fallback={<div className="screen active"><div className="empty"><p>Cargando...</p></div></div>}>
      <UbicacionesInner />
    </Suspense>
  );
}

function UbicacionesInner() {
  const { mostrarToast } = useUIStore();
  const searchParams = useSearchParams();
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'salon' | 'deposito'>('salon');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ubicacion | null>(null);
  const [formData, setFormData] = useState({ nombre: '', tipo: 'pasillo' as TipoUbicacion, parentId: null as string | null });
  const [filterTipo, setFilterTipo] = useState<TipoUbicacion[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [selectedProducts, setSelectedProducts] = useState<Producto[]>([]);

  useEffect(() => {
    dbUbicaciones.listar().then(setUbicaciones);
  }, []);

  useEffect(() => {
    if (ubicaciones.length === 0) return;
    const loadCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        ubicaciones.map(async (u) => {
          const count = await dbProductos.contarPorUbicacion(u.id);
          if (count > 0) counts[u.id] = count;
        })
      );
      setProductCounts(counts);
    };
    loadCounts();
  }, [ubicaciones]);

  useEffect(() => {
    const ubId = searchParams.get('ubicacion');
    if (ubId && ubicaciones.length > 0) {
      setSelectedId(ubId);
      const u = ubicaciones.find(x => x.id === ubId);
      if (u) {
        const isSalon = ['sucursal', 'pasillo', 'gondola', 'estante', 'posicion'].includes(u.tipo);
        setActiveTab(isSalon ? 'salon' : 'deposito');
      }
    }
  }, [searchParams, ubicaciones]);

  useEffect(() => {
    if (!selectedId) { setSelectedProducts([]); return; }
    dbProductos.obtenerPorUbicacion(selectedId).then(setSelectedProducts);
  }, [selectedId]);

  const selectedUbicacion = ubicaciones.find(u => u.id === selectedId);

  const handleCreate = (parentId: string | null, tipo: TipoUbicacion) => {
    setFormData({ nombre: '', tipo, parentId });
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (u: Ubicacion) => {
    setFormData({ nombre: u.nombre, tipo: u.tipo, parentId: u.parentId });
    setEditing(u);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await dbUbicaciones.eliminar(id);
    setUbicaciones(prev => prev.filter(u => u.id !== id));
    if (selectedId === id) setSelectedId(null);
    mostrarToast('exito', 'Ubicación eliminada');
  };

  const handleSaveModal = async () => {
    if (!formData.nombre.trim()) { mostrarToast('error', 'El nombre es obligatorio'); return; }
    try {
      if (editing) {
        await dbUbicaciones.actualizar(editing.id, { nombre: formData.nombre, tipo: formData.tipo, parentId: formData.parentId });
        setUbicaciones(prev => prev.map(u => u.id === editing.id ? { ...u, ...formData } : u));
        mostrarToast('exito', 'Ubicación actualizada');
      } else {
        const nueva = await dbUbicaciones.crear({ ...formData, activo: true });
        setUbicaciones(prev => [...prev, nueva]);
        setSelectedId(nueva.id);
        mostrarToast('exito', 'Ubicación creada');
      }
      setModalOpen(false);
    } catch (e: any) { mostrarToast('error', e.message); }
  };

  const currentTipos = activeTab === 'salon' ? TIPOS_SALON : TIPOS_DEPOSITO;

  return (
    <div className="screen active">
      <div>
        <p className="eyebrow">Ubicaciones</p>
        <h1 className="h-page">Árbol de ubicaciones</h1>
      </div>

      <div className="tabs">
        <button className={`tab${activeTab === 'salon' ? ' active' : ''}`} onClick={() => setActiveTab('salon')}>
          🏪 Salón
        </button>
        <button className={`tab${activeTab === 'deposito' ? ' active' : ''}`} onClick={() => setActiveTab('deposito')}>
          🏭 Depósito
        </button>
      </div>

      <div className="ubi-layout">
        {/* Sidebar - Tree */}
        <div className="panel" style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button className="btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={() => handleCreate(null, activeTab === 'salon' ? 'sucursal' : 'deposito')}>
                + Nueva {activeTab === 'salon' ? 'Sucursal' : 'Depósito'}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {currentTipos.map(t => (
                <label key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                  <input type="checkbox" checked={filterTipo.includes(t.value)} onChange={e => setFilterTipo(prev => e.target.checked ? [...prev, t.value] : prev.filter(x => x !== t.value))} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, padding: 8, overflow: 'auto' }}>
            <UbicacionTree
              ubicaciones={ubicaciones}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreate={handleCreate}
              onEdit={handleEdit}
              onDelete={handleDelete}
              filterTipo={filterTipo}
              productCounts={productCounts}
            />
          </div>
        </div>

        {/* Main - Detail */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedUbicacion ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: 1.1, fontWeight: 700 }}>{selectedUbicacion.nombre}</h2>
                  <span className="badge">{selectedUbicacion.tipo}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <IconBtn onClick={() => handleEdit(selectedUbicacion)} title="Editar info">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </IconBtn>
                  <IconBtn onClick={() => handleCreate(selectedUbicacion.id, selectedUbicacion.tipo === 'sucursal' || selectedUbicacion.tipo === 'deposito' ? 'pasillo' : 'posicion')} title="Añadir hijo">
                    <span style={{ fontSize: 16 }}>+</span>
                  </IconBtn>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {selectedProducts.length > 0 ? (
                  <>
                    <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                      {selectedProducts.length} producto{selectedProducts.length !== 1 ? 's' : ''} en esta ubicación
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedProducts.map(p => (
                        <Link key={p.id} href={`/producto/${p.id}/editar`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface-high)', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', textDecoration: 'none', color: 'var(--text)', transition: 'background .15s' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 'var(--r-lg)', background: 'var(--surface)', display: 'grid', placeItems: 'center', flexShrink: 0, border: '1px solid var(--line-soft)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-faint)' }}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                            <div style={{ fontSize: '.72rem', color: 'var(--text-faint)' }}>PLU: {p.plu || '—'} · Stock: {p.stockActual}</div>
                          </div>
                          <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--cyan)' }}>{formatMoney(p.precioVenta)}</span>
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty" style={{ flex: 1 }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-faint)', opacity: 0.5 }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                    <p>Sin productos asignados</p>
                    <p style={{ fontSize: '.85rem', color: 'var(--text-faint)', marginTop: 4 }}>Los productos se asignan desde su ficha o creación</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="panel" style={{ flex: 1, display: 'grid', placeItems: 'center', minHeight: 500 }}>
              <div className="empty">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-faint)', opacity: 0.5 }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                <p>Seleccioná una ubicación</p>
                <p style={{ fontSize: '.85rem', color: 'var(--text-faint)', marginTop: 4 }}>Creá ubicaciones en el panel izquierdo</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear/Editar */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>{editing ? 'Editar ubicación' : 'Nueva ubicación'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '.8rem', color: 'var(--text-faint)', marginBottom: 4 }}>Nombre *</label>
                <input value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej: Pasillo 1, Estante A" style={{ width: '100%', padding: '12px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)', background: 'var(--surface)', fontSize: '1rem' }} autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '.8rem', color: 'var(--text-faint)', marginBottom: 4 }}>Tipo</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {currentTipos.map(t => (
                    <button key={t.value} type="button" onClick={() => setFormData({ ...formData, tipo: t.value })} className={`chip${formData.tipo === t.value ? ' active' : ''}`} style={{ padding: 10, justifyContent: 'center' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '.8rem', color: 'var(--text-faint)', marginBottom: 4 }}>Padre (opcional)</label>
                <select value={formData.parentId || ''} onChange={e => setFormData({ ...formData, parentId: e.target.value || null })} style={{ width: '100%', padding: '12px 40px 12px 12px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)', background: 'var(--surface)', fontSize: '1rem' }}>
                  <option value="">— Ninguna (raíz) —</option>
                  {ubicaciones.filter(u => u.tipo !== 'posicion' && u.id !== editing?.id).map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} ({u.tipo})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 20px', borderTop: '1px solid var(--line-soft)' }}>
              <button className="btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveModal}>{editing ? 'Guardar cambios' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}