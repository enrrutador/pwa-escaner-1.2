'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, adminHeaders } from '@/store/authStore';
import type { RolUsuario } from '@/types';

// ---------- tipos locales ----------
interface UsuarioAdmin {
  id: string;
  correo: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt: number;
  deviceId?: string;
  lastLoginAt?: number;
  sessionExpiresAt?: number;
  tenantId?: string;
  telefono?: string;
  notas?: string;
}

type PlanTenant = 'gratuito' | 'basico' | 'pro' | 'empresarial';

interface TenantItem {
  id: string;
  nombre: string;
  correoContacto: string;
  telefono?: string;
  cuit?: string;
  plan: PlanTenant;
  activo: boolean;
  createdAt: number;
  vencimiento?: number;
  notas?: string;
}

const PLAN_LABEL: Record<PlanTenant, string> = {
  gratuito: 'Gratuito',
  basico: 'Básico',
  pro: 'Pro',
  empresarial: 'Empresarial',
};

const PLAN_COLOR: Record<PlanTenant, string> = {
  gratuito: '#888',
  basico: '#0ea5e9',
  pro: '#16a34a',
  empresarial: '#dc2626',
};

// ---------- helpers UI ----------
const fmt = (ts?: number) =>
  ts ? new Date(ts).toLocaleDateString('es-AR') + ' ' + new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—';

const fmtDate = (ts?: number) => ts ? new Date(ts).toLocaleDateString('es-AR') : '—';

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', borderRadius: 10, border: '1px solid #222',
  background: '#111', fontSize: '.95rem', color: 'white', outline: 'none', width: '100%',
};
const labelStyle: React.CSSProperties = { fontSize: '.75rem', fontWeight: 600, color: '#888', marginBottom: 4, display: 'block' };

function Modal({ title, onClose, children, onSubmit, submitLabel }: {
  title: string; onClose: () => void; children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void; submitLabel?: string;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#0a0a0a', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh',
        overflow: 'auto', border: '1px solid #222', color: 'white',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #222' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <form onSubmit={onSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
          {onSubmit && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={onClose} style={{ padding: '10px 16px', background: '#222', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" style={{ padding: '10px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>{submitLabel}</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span style={{
    display: 'inline-block', padding: '3px 10px', borderRadius: 999,
    fontSize: '.7rem', fontWeight: 700, color, background: `${color}22`,
  }}>{children}</span>;
}

// ---------- página ----------
export default function AdminPage() {
  const router = useRouter();
  const { usuario, esSuperAdmin, inicializado } = useAuthStore();
  const [tab, setTab] = useState<'tenants' | 'usuarios'>('tenants');
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(true);

  const [editTenant, setEditTenant] = useState<TenantItem | null>(null);
  const [newTenantOpen, setNewTenantOpen] = useState(false);
  const [editUser, setEditUser] = useState<UsuarioAdmin | null>(null);
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UsuarioAdmin | null>(null);

  const flash = (m: string) => { setMensaje(m); setTimeout(() => setMensaje(''), 3500); };

  const cargar = useCallback(async () => {
    if (!inicializado || !esSuperAdmin()) return;
    try {
      const [rT, rU] = await Promise.all([
        fetch('/api/admin/tenants', { headers: adminHeaders(usuario) }),
        fetch('/api/admin/usuarios', { headers: adminHeaders(usuario) }),
      ]);
      const dT = await rT.json();
      const dU = await rU.json();
      if (dT.ok) setTenants(dT.tenants);
      if (dU.ok) setUsuarios(dU.usuarios);
    } catch {}
    setLoading(false);
  }, [inicializado, esSuperAdmin, usuario]);

  useEffect(() => {
    if (!inicializado) return;
    if (!esSuperAdmin()) { router.replace('/'); return; }
    cargar();
  }, [inicializado, esSuperAdmin, router, cargar]);

  const tenantNombre = (id?: string) => tenants.find(t => t.id === id)?.nombre || '—';

  // ---------- acciones tenant ----------
  const crearTenant = async (data: any) => {
    const res = await fetch('/api/admin/tenants', {
      method: 'POST', headers: adminHeaders(usuario),
      body: JSON.stringify(data),
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error);
    return d.tenant;
  };

  const actualizarTenant = async (id: string, data: any) => {
    const res = await fetch(`/api/admin/tenants/${id}`, {
      method: 'PATCH', headers: adminHeaders(usuario),
      body: JSON.stringify(data),
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error);
    return d.tenant;
  };

  const desactivarTenant = async (id: string) => {
    if (!confirm('¿Desactivar este cliente? Los usuarios no podrán iniciar sesión.')) return;
    try {
      await fetch(`/api/admin/tenants/${id}`, { method: 'DELETE', headers: adminHeaders(usuario) });
      flash('Cliente desactivado');
      await cargar();
    } catch (e: any) { flash(e.message); }
  };

  // ---------- acciones usuario ----------
  const crearUsuario = async (data: any) => {
    const res = await fetch('/api/admin/usuarios', {
      method: 'POST', headers: adminHeaders(usuario),
      body: JSON.stringify(data),
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error);
    return d.usuario;
  };

  const actualizarUsuario = async (correo: string, data: any) => {
    const res = await fetch(`/api/admin/usuarios/${encodeURIComponent(correo)}`, {
      method: 'PATCH', headers: adminHeaders(usuario),
      body: JSON.stringify(data),
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error);
    return d.usuario;
  };

  const resetPassword = async (correo: string, nueva: string) => {
    const res = await fetch(`/api/admin/usuarios/${encodeURIComponent(correo)}`, {
      method: 'PUT', headers: adminHeaders(usuario),
      body: JSON.stringify({ password: nueva }),
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error);
  };

  const liberarDispositivo = async (correo: string) => {
    if (!confirm('¿Liberar el dispositivo de este usuario? Podrá iniciar sesión desde otro.')) return;
    try {
      await fetch(`/api/admin/usuarios/${encodeURIComponent(correo)}`, { method: 'DELETE', headers: adminHeaders(usuario) });
      flash('Dispositivo liberado');
      await cargar();
    } catch (e: any) { flash(e.message); }
  };

  if (!inicializado) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#888' }}>Cargando...</div>;
  }
  if (!esSuperAdmin()) return null;

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: 'white', padding: '20px 16px 100px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: '#dc2626', fontSize: '.75rem', fontWeight: 700, letterSpacing: 1, margin: 0 }}>SUPER-ADMIN</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '4px 0' }}>Dashboard de Administración</h1>
          <p style={{ color: '#888', margin: 0, fontSize: '.9rem' }}>Gestioná clientes, usuarios y suscripciones</p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #222', paddingBottom: 0 }}>
          {(['tenants', 'usuarios'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 20px', background: tab === t ? '#dc2626' : 'transparent',
              color: tab === t ? 'white' : '#888', border: 'none', borderBottom: tab === t ? '2px solid #dc2626' : '2px solid transparent',
              cursor: 'pointer', fontWeight: 600, fontSize: '.95rem', marginBottom: -1,
            }}>
              {t === 'tenants' ? `Clientes (${tenants.length})` : `Usuarios (${usuarios.length})`}
            </button>
          ))}
        </div>

        {mensaje && (
          <div style={{ padding: '12px 16px', marginBottom: 16, borderRadius: 10, background: '#16a34a22', color: '#22c55e', fontSize: '.9rem' }}>
            {mensaje}
          </div>
        )}

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>Cargando datos...</p>
        ) : tab === 'tenants' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => setNewTenantOpen(true)} style={{
                padding: '10px 18px', background: '#dc2626', color: 'white', border: 'none',
                borderRadius: 10, cursor: 'pointer', fontWeight: 600,
              }}>+ Nuevo cliente</button>
            </div>
            {tenants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>
                <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>No hay clientes todavía</p>
                <p style={{ fontSize: '.85rem', marginTop: 4 }}>Creá tu primer cliente para empezar a vender</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tenants.map(t => {
                  const usuariosTenant = usuarios.filter(u => u.tenantId === t.id);
                  const vencido = t.vencimiento ? t.vencimiento < Date.now() : false;
                  return (
                    <div key={t.id} style={{
                      background: '#111', borderRadius: 14, padding: 18, border: '1px solid #222',
                      opacity: t.activo ? 1 : 0.55,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{t.nombre}</h3>
                            <Badge color={PLAN_COLOR[t.plan]}>{PLAN_LABEL[t.plan]}</Badge>
                            {!t.activo && <Badge color="#666">Inactivo</Badge>}
                            {vencido && <Badge color="#dc2626">Vencido</Badge>}
                          </div>
                          <div style={{ fontSize: '.82rem', color: '#888', marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '4px 16px' }}>
                            <div>📧 {t.correoContacto}</div>
                            <div>📞 {t.telefono || '—'}</div>
                            <div>🆔 CUIT: {t.cuit || '—'}</div>
                            <div>👥 {usuariosTenant.length} usuario(s)</div>
                            <div>📅 Alta: {fmtDate(t.createdAt)}</div>
                            <div style={{ color: vencido ? '#dc2626' : '#888' }}>⏰ Vence: {fmtDate(t.vencimiento)}</div>
                          </div>
                          {t.notas && <div style={{ marginTop: 8, fontSize: '.8rem', color: '#666', fontStyle: 'italic' }}>📝 {t.notas}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <button onClick={() => setEditTenant(t)} style={{
                            padding: '8px 14px', background: '#222', color: 'white', border: 'none',
                            borderRadius: 8, cursor: 'pointer', fontSize: '.85rem', fontWeight: 600,
                          }}>Editar</button>
                          {t.activo && (
                            <button onClick={() => desactivarTenant(t.id)} style={{
                              padding: '8px 14px', background: 'transparent', color: '#dc2626', border: '1px solid #dc2626',
                              borderRadius: 8, cursor: 'pointer', fontSize: '.8rem',
                            }}>Desactivar</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => setNewUserOpen(true)} style={{
                padding: '10px 18px', background: '#dc2626', color: 'white', border: 'none',
                borderRadius: 10, cursor: 'pointer', fontWeight: 600,
              }}>+ Nuevo usuario</button>
            </div>
            {usuarios.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: 40 }}>No hay usuarios.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #222', textAlign: 'left', color: '#888' }}>
                      <th style={{ padding: '10px 8px' }}>Nombre</th>
                      <th style={{ padding: '10px 8px' }}>Correo</th>
                      <th style={{ padding: '10px 8px' }}>Rol</th>
                      <th style={{ padding: '10px 8px' }}>Cliente</th>
                      <th style={{ padding: '10px 8px' }}>Alta</th>
                      <th style={{ padding: '10px 8px' }}>Últ. login</th>
                      <th style={{ padding: '10px 8px' }}>Estado</th>
                      <th style={{ padding: '10px 8px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(u => {
                      const isSuper = u.correo === 'atenciafab@gmail.com';
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                          <td style={{ padding: '12px 8px', fontWeight: 600 }}>{u.nombre}{isSuper && ' 👑'}</td>
                          <td style={{ padding: '12px 8px', color: '#aaa', wordBreak: 'break-all' }}>{u.correo}</td>
                          <td style={{ padding: '12px 8px' }}>
                            <Badge color={u.rol === 'admin' ? '#dc2626' : '#0ea5e9'}>{u.rol}</Badge>
                          </td>
                          <td style={{ padding: '12px 8px', color: '#aaa' }}>{isSuper ? '— (súper)' : tenantNombre(u.tenantId)}</td>
                          <td style={{ padding: '12px 8px', color: '#888', whiteSpace: 'nowrap' }}>{fmtDate(u.createdAt)}</td>
                          <td style={{ padding: '12px 8px', color: '#888', whiteSpace: 'nowrap' }}>{fmt(u.lastLoginAt)}</td>
                          <td style={{ padding: '12px 8px' }}>
                            {u.activo
                              ? <Badge color="#16a34a">Activo</Badge>
                              : <Badge color="#dc2626">Bloqueado</Badge>}
                            {u.deviceId && <div style={{ fontSize: '.7rem', color: '#666', marginTop: 4 }} title={u.deviceId}>📱 amarrado</div>}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {!isSuper && (
                                <>
                                  <button onClick={() => setEditUser(u)} style={{ padding: '6px 10px', background: '#222', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '.78rem' }}>Editar</button>
                                  <button onClick={() => setResetTarget(u)} style={{ padding: '6px 10px', background: '#222', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '.78rem' }}>🔑</button>
                                  {u.deviceId && <button onClick={() => liberarDispositivo(u.correo)} style={{ padding: '6px 10px', background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', fontSize: '.78rem' }} title="Liberar dispositivo">📱</button>}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== Modal: nuevo cliente ===== */}
      {newTenantOpen && (
        <NewTenantModal
          onClose={() => setNewTenantOpen(false)}
          onSubmit={async (d) => {
            try { await crearTenant(d); setNewTenantOpen(false); flash('Cliente creado'); await cargar(); }
            catch (e: any) { alert(e.message); }
          }}
        />
      )}

      {/* ===== Modal: editar cliente ===== */}
      {editTenant && (
        <EditTenantModal
          tenant={editTenant}
          onClose={() => setEditTenant(null)}
          onSubmit={async (d) => {
            try { await actualizarTenant(editTenant.id, d); setEditTenant(null); flash('Cliente actualizado'); await cargar(); }
            catch (e: any) { alert(e.message); }
          }}
        />
      )}

      {/* ===== Modal: nuevo usuario ===== */}
      {newUserOpen && (
        <NewUserModal
          tenants={tenants.filter(t => t.activo)}
          onClose={() => setNewUserOpen(false)}
          onSubmit={async (d) => {
            try { await crearUsuario(d); setNewUserOpen(false); flash('Usuario creado'); await cargar(); }
            catch (e: any) { alert(e.message); }
          }}
        />
      )}

      {/* ===== Modal: editar usuario ===== */}
      {editUser && (
        <EditUserModal
          user={editUser}
          tenants={tenants.filter(t => t.activo)}
          onClose={() => setEditUser(null)}
          onSubmit={async (d) => {
            try { await actualizarUsuario(editUser.correo, d); setEditUser(null); flash('Usuario actualizado'); await cargar(); }
            catch (e: any) { alert(e.message); }
          }}
        />
      )}

      {/* ===== Modal: reset password ===== */}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onSubmit={async (nueva) => {
            try { await resetPassword(resetTarget.correo, nueva); setResetTarget(null); flash(`Contraseña reiniciada y sesión cerrada en ${resetTarget.nombre}`); await cargar(); }
            catch (e: any) { alert(e.message); }
          }}
        />
      )}
    </div>
  );
}

// ===================== Sub-componentes =====================

function NewTenantModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (d: any) => Promise<void> }) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cuit, setCuit] = useState('');
  const [plan, setPlan] = useState('basico');
  const [vencimiento, setVencimiento] = useState('');

  return (
    <Modal title="Nuevo cliente" onClose={onClose} submitLabel="Crear" onSubmit={(e) => {
      e.preventDefault();
      const d: any = { nombre, correoContacto: correo, telefono, cuit, plan };
      if (vencimiento) d.vencimiento = new Date(vencimiento).getTime();
      onSubmit(d);
    }}>
      <div><label style={labelStyle}>NOMBRE *</label><input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} autoFocus required /></div>
      <div><label style={labelStyle}>CORREO DE CONTACTO *</label><input style={inputStyle} type="email" value={correo} onChange={e => setCorreo(e.target.value)} required /></div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><label style={labelStyle}>TELÉFONO</label><input style={inputStyle} value={telefono} onChange={e => setTelefono(e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={labelStyle}>CUIT</label><input style={inputStyle} value={cuit} onChange={e => setCuit(e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><label style={labelStyle}>PLAN</label>
          <select style={inputStyle} value={plan} onChange={e => setPlan(e.target.value)}>
            <option value="gratuito">Gratuito</option>
            <option value="basico">Básico</option>
            <option value="pro">Pro</option>
            <option value="empresarial">Empresarial</option>
          </select>
        </div>
        <div style={{ flex: 1 }}><label style={labelStyle}>VENCIMIENTO</label><input style={inputStyle} type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function EditTenantModal({ tenant, onClose, onSubmit }: { tenant: TenantItem; onClose: () => void; onSubmit: (d: any) => Promise<void> }) {
  const [nombre, setNombre] = useState(tenant.nombre);
  const [correo, setCorreo] = useState(tenant.correoContacto);
  const [telefono, setTelefono] = useState(tenant.telefono || '');
  const [cuit, setCuit] = useState(tenant.cuit || '');
  const [plan, setPlan] = useState(tenant.plan);
  const [vencimiento, setVencimiento] = useState(tenant.vencimiento ? new Date(tenant.vencimiento).toISOString().slice(0, 10) : '');
  const [notas, setNotas] = useState(tenant.notas || '');
  const [activo, setActivo] = useState(tenant.activo);

  return (
    <Modal title={`Editar ${tenant.nombre}`} onClose={onClose} submitLabel="Guardar" onSubmit={(e) => {
      e.preventDefault();
      const d: any = { nombre, correoContacto: correo, telefono, cuit, plan, activo, notas };
      if (vencimiento) d.vencimiento = new Date(vencimiento).getTime();
      onSubmit(d);
    }}>
      <div><label style={labelStyle}>NOMBRE</label><input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} /></div>
      <div><label style={labelStyle}>CORREO DE CONTACTO</label><input style={inputStyle} type="email" value={correo} onChange={e => setCorreo(e.target.value)} /></div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><label style={labelStyle}>TELÉFONO</label><input style={inputStyle} value={telefono} onChange={e => setTelefono(e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={labelStyle}>CUIT</label><input style={inputStyle} value={cuit} onChange={e => setCuit(e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><label style={labelStyle}>PLAN</label>
          <select style={inputStyle} value={plan} onChange={e => setPlan(e.target.value as any)}>
            <option value="gratuito">Gratuito</option>
            <option value="basico">Básico</option>
            <option value="pro">Pro</option>
            <option value="empresarial">Empresarial</option>
          </select>
        </div>
        <div style={{ flex: 1 }}><label style={labelStyle}>VENCIMIENTO</label><input style={inputStyle} type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} /></div>
      </div>
      <div><label style={labelStyle}>NOTAS</label><textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={notas} onChange={e => setNotas(e.target.value)} /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.9rem' }}>
        <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} /> Cliente activo
      </label>
    </Modal>
  );
}

function NewUserModal({ tenants, onClose, onSubmit }: { tenants: TenantItem[]; onClose: () => void; onSubmit: (d: any) => Promise<void> }) {
  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolUsuario>('operador');
  const [tenantId, setTenantId] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');

  return (
    <Modal title="Nuevo usuario" onClose={onClose} submitLabel="Crear" onSubmit={(e) => {
      e.preventDefault();
      const d: any = { correo, nombre, password, rol, telefono, notas };
      if (tenantId) d.tenantId = tenantId;
      onSubmit(d);
    }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><label style={labelStyle}>NOMBRE *</label><input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} required /></div>
        <div style={{ flex: 1 }}><label style={labelStyle}>TELÉFONO</label><input style={inputStyle} value={telefono} onChange={e => setTelefono(e.target.value)} /></div>
      </div>
      <div><label style={labelStyle}>CORREO *</label><input style={inputStyle} type="email" value={correo} onChange={e => setCorreo(e.target.value)} required /></div>
      <div><label style={labelStyle}>CONTRASEÑA *</label><input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required /></div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><label style={labelStyle}>ROL</label>
          <select style={inputStyle} value={rol} onChange={e => setRol(e.target.value as RolUsuario)}>
            <option value="operador">Operador</option>
            <option value="admin">Admin (del cliente)</option>
            <option value="viewer">Viewer (lectura)</option>
          </select>
        </div>
        <div style={{ flex: 1 }}><label style={labelStyle}>CLIENTE</label>
          <select style={inputStyle} value={tenantId} onChange={e => setTenantId(e.target.value)}>
            <option value="">Sin cliente</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
      </div>
      <div><label style={labelStyle}>NOTAS</label><textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={notas} onChange={e => setNotas(e.target.value)} /></div>
    </Modal>
  );
}

function EditUserModal({ user, tenants, onClose, onSubmit }: { user: UsuarioAdmin; tenants: TenantItem[]; onClose: () => void; onSubmit: (d: any) => Promise<void> }) {
  const [nombre, setNombre] = useState(user.nombre);
  const [rol, setRol] = useState<RolUsuario>(user.rol);
  const [tenantId, setTenantId] = useState(user.tenantId || '');
  const [activo, setActivo] = useState(user.activo);
  const [telefono, setTelefono] = useState(user.telefono || '');
  const [notas, setNotas] = useState(user.notas || '');

  return (
    <Modal title={`Editar ${user.nombre}`} onClose={onClose} submitLabel="Guardar" onSubmit={(e) => {
      e.preventDefault();
      const d: any = { nombre, rol, activo, telefono, notas };
      d.tenantId = tenantId || null;
      onSubmit(d);
    }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><label style={labelStyle}>NOMBRE</label><input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={labelStyle}>TELÉFONO</label><input style={inputStyle} value={telefono} onChange={e => setTelefono(e.target.value)} /></div>
      </div>
      <div><label style={labelStyle}>CORREO (no editable)</label><input style={{ ...inputStyle, opacity: .5 }} value={user.correo} disabled /></div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><label style={labelStyle}>ROL</label>
          <select style={inputStyle} value={rol} onChange={e => setRol(e.target.value as RolUsuario)}>
            <option value="operador">Operador</option>
            <option value="admin">Admin (del cliente)</option>
            <option value="viewer">Viewer (lectura)</option>
          </select>
        </div>
        <div style={{ flex: 1 }}><label style={labelStyle}>CLIENTE</label>
          <select style={inputStyle} value={tenantId} onChange={e => setTenantId(e.target.value)}>
            <option value="">Sin cliente</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
      </div>
      <div><label style={labelStyle}>NOTAS</label><textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={notas} onChange={e => setNotas(e.target.value)} /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.9rem' }}>
        <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} /> Usuario activo
      </label>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onSubmit }: { user: UsuarioAdmin; onClose: () => void; onSubmit: (nueva: string) => Promise<void> }) {
  const [nueva, setNueva] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  return (
    <Modal title={`Reiniciar contraseña de ${user.nombre}`} onClose={onClose} submitLabel="Reiniciar" onSubmit={(e) => {
      e.preventDefault();
      if (nueva.length < 8) { setError('Mínimo 8 caracteres'); return; }
      if (nueva !== confirm) { setError('Las contraseñas no coinciden'); return; }
      setError('');
      onSubmit(nueva);
    }}>
      <div><label style={labelStyle}>NUEVA CONTRASEÑA</label><input style={inputStyle} type="password" value={nueva} onChange={e => setNueva(e.target.value)} autoFocus /></div>
      <div><label style={labelStyle}>CONFIRMAR</label><input style={inputStyle} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
      <p style={{ color: '#888', fontSize: '.8rem' }}>⚠️ La sesión actual de {user.nombre} se cerrará y deberá ingresar con la nueva contraseña.</p>
      {error && <p style={{ color: '#ef4444', fontSize: '.85rem', margin: 0 }}>{error}</p>}
    </Modal>
  );
}
