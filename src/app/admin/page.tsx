'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, adminHeaders } from '@/store/authStore';
import type { RolUsuario } from '@/types';

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
}

interface TenantItem {
  id: string;
  nombre: string;
  correoContacto: string;
  activo: boolean;
  createdAt: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { usuario, esSuperAdmin, inicializado } = useAuthStore();
  const [tab, setTab] = useState<'usuarios' | 'tenants'>('usuarios');

  // Usuarios
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');

  // Crear usuario
  const [crearOpen, setCrearOpen] = useState(false);
  const [cCorreo, setCCorreo] = useState('');
  const [cNombre, setCNombre] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cRol, setCRol] = useState<RolUsuario>('operador');
  const [cTenantId, setCTenantId] = useState('');
  const [crearError, setCrearError] = useState('');
  const [crearLoading, setCrearLoading] = useState(false);

  // Cambiar contraseña de un usuario
  const [usrOpen, setUsrOpen] = useState(false);
  const [usrTarget, setUsrTarget] = useState<UsuarioAdmin | null>(null);
  const [usrPass, setUsrPass] = useState('');
  const [usrConfirm, setUsrConfirm] = useState('');
  const [usrError, setUsrError] = useState('');

  // Tenants
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [tLoading, setTLoading] = useState(false);
  const [tOpen, setTOpen] = useState(false);
  const [tNombre, setTNombre] = useState('');
  const [tCorreo, setTCorreo] = useState('');
  const [tError, setTError] = useState('');

  const cargarUsuarios = useCallback(async () => {
    if (!inicializado || !esSuperAdmin() || !usuario) return;
    try {
      const res = await fetch('/api/admin/usuarios', { headers: adminHeaders(usuario) });
      const data = await res.json();
      if (data.ok) setUsuarios(data.usuarios);
    } catch {}
    setLoading(false);
  }, [inicializado, esSuperAdmin, usuario]);

  const cargarTenants = useCallback(async () => {
    if (!inicializado || !esSuperAdmin() || !usuario) return;
    setTLoading(true);
    try {
      const res = await fetch('/api/admin/tenants', { headers: adminHeaders(usuario) });
      const data = await res.json();
      if (data.ok) setTenants(data.tenants);
    } catch {}
    setTLoading(false);
  }, [inicializado, esSuperAdmin, usuario]);

  useEffect(() => {
    if (!inicializado) return;
    if (!esSuperAdmin()) {
      router.replace('/');
      return;
    }
    cargarUsuarios();
    cargarTenants();
  }, [inicializado, esSuperAdmin, router, cargarUsuarios, cargarTenants]);

  const flash = (m: string, ms = 3000) => {
    setMensaje(m);
    setTimeout(() => setMensaje(''), ms);
  };

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setCrearError('');
    if (!cCorreo.trim() || !cNombre.trim() || !cPassword) {
      setCrearError('Completá todos los campos');
      return;
    }
    if (cPassword.length < 8) {
      setCrearError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setCrearLoading(true);
    try {
      const body: Record<string, any> = {
        correo: cCorreo.trim(),
        nombre: cNombre.trim(),
        password: cPassword,
        rol: cRol,
      };
      if (cTenantId) body.tenantId = cTenantId;
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: adminHeaders(usuario),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCrearError(data.error || 'Error al crear usuario');
        return;
      }
      setCrearOpen(false);
      resetCrear();
      flash(`Usuario "${cNombre.trim()}" creado`);
      await cargarUsuarios();
    } catch (err: any) {
      setCrearError(err.message || 'Error');
    } finally {
      setCrearLoading(false);
    }
  };

  const resetCrear = () => {
    setCCorreo(''); setCNombre(''); setCPassword(''); setCRol('operador'); setCTenantId(''); setCrearError('');
  };

  const handleUsrPwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsrError('');
    if (usrPass.length < 8) { setUsrError('Mínimo 8 caracteres'); return; }
    if (usrPass !== usrConfirm) { setUsrError('Las contraseñas no coinciden'); return; }
    try {
      const res = await fetch(`/api/admin/usuarios/${encodeURIComponent(usrTarget!.correo)}`, {
        method: 'PUT',
        headers: adminHeaders(usuario),
        body: JSON.stringify({ password: usrPass }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setUsrError(data.error || 'Error'); return; }
      setUsrOpen(false); setUsrPass(''); setUsrConfirm('');
      flash(`Contraseña de "${usrTarget?.nombre}" actualizada`);
    } catch (err: any) {
      setUsrError(err.message);
    }
  };

  const handleCrearTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setTError('');
    if (!tNombre.trim() || !tCorreo.trim()) { setTError('Completá todos los campos'); return; }
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: adminHeaders(usuario),
        body: JSON.stringify({ nombre: tNombre.trim(), correoContacto: tCorreo.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setTError(data.error || 'Error'); return; }
      setTOpen(false); setTNombre(''); setTCorreo('');
      flash(`Tenant "${tNombre.trim()}" creado`);
      await cargarTenants();
    } catch (err: any) {
      setTError(err.message);
    }
  };

  if (!inicializado) {
    return (
      <div className="screen active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <p style={{ color: 'var(--text-faint)' }}>Cargando...</p>
      </div>
    );
  }
  if (!esSuperAdmin()) return null;

  const fmt = (ts?: number) => ts ? new Date(ts).toLocaleDateString('es-AR') + ' ' + new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="screen active" style={{ paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="h-page">Administración</h1>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        <button className={tab === 'usuarios' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('usuarios')} style={{ height: 40 }}>
          Usuarios
        </button>
        <button className={tab === 'tenants' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('tenants')} style={{ height: 40 }}>
          Clientes
        </button>
      </div>

      {mensaje && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--r-lg)',
          background: 'color-mix(in srgb, var(--success) 15%, transparent)',
          color: 'var(--success)', fontSize: '.85rem', margin: '12px 0',
        }}>
          {mensaje}
        </div>
      )}

      {/* ========== TAB USUARIOS ========== */}
      {tab === 'usuarios' && (<>
      {loading ? (
        <div className="empty" style={{ marginTop: 40 }}>
          <p>Cargando usuarios...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={() => { setCrearOpen(true); resetCrear(); }} style={{ height: 44 }}>
              + Nuevo usuario
            </button>
          </div>
          {usuarios.map((u) => (
            <div
              key={u.id}
              style={{
                background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                padding: 16, border: '1px solid var(--line-soft)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>{u.nombre}</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text-faint)', marginTop: 2, wordBreak: 'break-all' }}>
                    {u.correo}
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'var(--text-dim)', marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--r-full)',
                      fontSize: '.7rem', fontWeight: 700,
                      background: u.rol === 'admin' ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'color-mix(in srgb, var(--cyan) 20%, transparent)',
                      color: u.rol === 'admin' ? 'var(--primary)' : 'var(--cyan)',
                    }}>
                      {u.rol.toUpperCase()}
                    </span>
                    {u.tenantId && <span style={{ color: 'var(--text-faint)' }}>Tenant: {u.tenantId.slice(0, 12)}…</span>}
                    <span>Últ. login: {fmt(u.lastLoginAt)}</span>
                  </div>
                </div>
                <button
                  className="icon-btn"
                  onClick={() => { setUsrTarget(u); setUsrOpen(true); setUsrPass(''); setUsrConfirm(''); setUsrError(''); }}
                  title="Cambiar contraseña"
                  style={{ width: 36, height: 36, flexShrink: 0 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>)}

      {/* ========== TAB CLIENTES ========== */}
      {tab === 'tenants' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="btn-primary" onClick={() => { setTOpen(true); setTNombre(''); setTCorreo(''); setTError(''); }} style={{ height: 44 }}>
              + Nuevo cliente
            </button>
          </div>
          {tLoading ? (
            <div className="empty" style={{ marginTop: 40 }}><p>Cargando clientes...</p></div>
          ) : tenants.length === 0 ? (
            <div className="empty" style={{ marginTop: 40 }}><p>No hay clientes todavía</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              {tenants.map((t) => (
                <div key={t.id} style={{
                  background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                  padding: 16, border: '1px solid var(--line-soft)',
                  opacity: t.activo ? 1 : 0.5,
                }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>{t.nombre}</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text-faint)', marginTop: 2 }}>{t.correoContacto}</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                    Creado: {fmt(t.createdAt)} {!t.activo && '(inactivo)'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal: Crear usuario */}
      {crearOpen && (
        <div className="modal-overlay" onClick={() => setCrearOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Nuevo usuario</h2>
              <button className="modal-close" onClick={() => setCrearOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleCrear}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>NOMBRE</label>
                  <input type="text" value={cNombre} onChange={(e) => setCNombre(e.target.value)} placeholder="Nombre del usuario" autoFocus
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>CORREO</label>
                  <input type="email" value={cCorreo} onChange={(e) => setCCorreo(e.target.value)} placeholder="nombre@correo.com"
                    autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>CONTRASEÑA</label>
                  <input type="password" value={cPassword} onChange={(e) => setCPassword(e.target.value)} placeholder="Mínimo 8 caracteres"
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>ROL</label>
                  <select value={cRol} onChange={(e) => setCRol(e.target.value as RolUsuario)}
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }}>
                    <option value="operador">Operador</option>
                    <option value="admin">Admin del cliente</option>
                    <option value="viewer">Viewer (solo lectura)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>CLIENTE (TENANT)</label>
                  <select value={cTenantId} onChange={(e) => setCTenantId(e.target.value)}
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }}>
                    <option value="">Sin cliente (super-admin)</option>
                    {tenants.filter((t) => t.activo).map((t) => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </div>
                {crearError && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--r-lg)', background: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)', fontSize: '.85rem', textAlign: 'center' }}>{crearError}</div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setCrearOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={crearLoading}>{crearLoading ? 'Creando...' : 'Crear usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nuevo cliente */}
      {tOpen && (
        <div className="modal-overlay" onClick={() => setTOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Nuevo cliente</h2>
              <button className="modal-close" onClick={() => setTOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleCrearTenant}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>NOMBRE DEL CLIENTE</label>
                  <input type="text" value={tNombre} onChange={(e) => setTNombre(e.target.value)} placeholder="Ej: Distribuidora López" autoFocus
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>CORREO DE CONTACTO</label>
                  <input type="email" value={tCorreo} onChange={(e) => setTCorreo(e.target.value)} placeholder="admin@cliente.com"
                    autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }} />
                </div>
                {tError && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--r-lg)', background: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)', fontSize: '.85rem', textAlign: 'center' }}>{tError}</div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setTOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Crear cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cambiar contraseña de usuario */}
      {usrOpen && usrTarget && (
        <div className="modal-overlay" onClick={() => setUsrOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Cambiar contraseña de {usrTarget.nombre}</h2>
              <button className="modal-close" onClick={() => setUsrOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleUsrPwd}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>NUEVA CONTRASEÑA</label>
                  <input type="password" value={usrPass} onChange={(e) => setUsrPass(e.target.value)} placeholder="Mínimo 8 caracteres" autoFocus
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>CONFIRMAR</label>
                  <input type="password" value={usrConfirm} onChange={(e) => setUsrConfirm(e.target.value)} placeholder="Repetir contraseña"
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }} />
                </div>
                {usrError && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--r-lg)', background: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)', fontSize: '.85rem', textAlign: 'center' }}>{usrError}</div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setUsrOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
