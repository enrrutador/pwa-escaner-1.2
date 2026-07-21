'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { dbUsuarios } from '@/lib/db-usuarios';
import type { Usuario, RolUsuario } from '@/types';

export default function AdminPage() {
  const router = useRouter();
  const { usuario, esAdmin, inicializado, logout } = useAuthStore();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [crearOpen, setCrearOpen] = useState(false);
  const [crearNombre, setCrearNombre] = useState('');
  const [crearPin, setCrearPin] = useState('');
  const [crearRol, setCrearRol] = useState<RolUsuario>('operador');
  const [crearError, setCrearError] = useState('');
  const [mensaje, setMensaje] = useState('');

  // Cambiar mi contraseña (admin)
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdNueva, setPwdNueva] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdError, setPwdError] = useState('');

  // Cambiar PIN de un usuario
  const [pinOpen, setPinOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<Usuario | null>(null);
  const [pinNuevo, setPinNuevo] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');

  const cargarUsuarios = useCallback(async () => {
    if (!inicializado || !esAdmin()) return;
    const list = await dbUsuarios.listar();
    setUsuarios(list);
    setLoading(false);
  }, [inicializado, esAdmin]);

  useEffect(() => {
    if (!inicializado) return;
    if (!esAdmin()) {
      router.replace('/');
      return;
    }
    cargarUsuarios();
  }, [inicializado, esAdmin, router, cargarUsuarios]);

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setCrearError('');
    if (!crearNombre.trim() || !crearPin.trim()) {
      setCrearError('Completá todos los campos');
      return;
    }
    if (crearPin.length < 4) {
      setCrearError('El PIN debe tener al menos 4 dígitos');
      return;
    }
    try {
      await dbUsuarios.crear({ nombre: crearNombre.trim(), pin: crearPin.trim(), rol: crearRol });
      setCrearOpen(false);
      setCrearNombre('');
      setCrearPin('');
      setCrearRol('operador');
      setMensaje(`Usuario "${crearNombre.trim()}" creado`);
      setTimeout(() => setMensaje(''), 3000);
      await cargarUsuarios();
    } catch (err: any) {
      setCrearError(err.message || 'Error al crear usuario');
    }
  };

  const handleRevocar = async (u: Usuario) => {
    if (!confirm(`¿Revocar acceso a "${u.nombre}"? Se desactivará y se limpiará su dispositivo.`)) return;
    await dbUsuarios.revocarAcceso(u.id);
    setMensaje(`Acceso de "${u.nombre}" revocado`);
    setTimeout(() => setMensaje(''), 3000);
    await cargarUsuarios();
  };

  const handleExtender = async (u: Usuario) => {
    await dbUsuarios.extenderSesion(u.id, 30);
    setMensaje(`Sesión de "${u.nombre}" extendida 30 días`);
    setTimeout(() => setMensaje(''), 3000);
    await cargarUsuarios();
  };

  const handleToggleActivo = async (u: Usuario) => {
    await dbUsuarios.actualizar(u.id, { activo: !u.activo });
    setMensaje(`Usuario "${u.nombre}" ${u.activo ? 'desactivado' : 'activado'}`);
    setTimeout(() => setMensaje(''), 3000);
    await cargarUsuarios();
  };

  const handleCambiarPwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    if (pwdNueva.length < 8) { setPwdError('Mínimo 8 caracteres'); return; }
    if (pwdNueva !== pwdConfirm) { setPwdError('Las contraseñas no coinciden'); return; }
    try {
      await dbUsuarios.actualizarPassword(usuario!.id, pwdNueva);
      setPwdOpen(false); setPwdNueva(''); setPwdConfirm('');
      setMensaje('Tu contraseña fue actualizada. Cerrá sesión y volvé a entrar.');
      setTimeout(() => setMensaje(''), 4000);
    } catch (err: any) {
      setPwdError(err.message || 'Error');
    }
  };

  const handleCambiarPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (pinNuevo.length < 4) { setPinError('Mínimo 4 dígitos'); return; }
    if (pinNuevo !== pinConfirm) { setPinError('Los PINes no coinciden'); return; }
    try {
      await dbUsuarios.actualizar(pinTarget!.id, { pin: pinNuevo });
      setPinOpen(false); setPinNuevo(''); setPinConfirm(''); setPinTarget(null);
      setMensaje(`PIN de "${pinTarget?.nombre}" actualizado`);
      setTimeout(() => setMensaje(''), 3000);
      await cargarUsuarios();
    } catch (err: any) {
      setPinError(err.message || 'Error');
    }
  };

  if (!inicializado) {
    return (
      <div className="screen active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <p style={{ color: 'var(--text-faint)' }}>Cargando...</p>
      </div>
    );
  }

  if (!esAdmin()) return null;

  const formatDate = (ts?: number) => ts ? new Date(ts).toLocaleDateString('es-AR') + ' ' + new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="screen active" style={{ paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="h-page">Administración</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-ghost"
            onClick={() => { setPwdOpen(true); setPwdNueva(''); setPwdConfirm(''); setPwdError(''); }}
            style={{ height: 44 }}
          >
            🔑 Cambiar mi contraseña
          </button>
          <button
            className="btn-primary"
            onClick={() => setCrearOpen(true)}
            style={{ height: 44 }}
          >
            + Nuevo usuario
          </button>
        </div>
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

      {loading ? (
        <div className="empty" style={{ marginTop: 40 }}>
          <p>Cargando usuarios...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          {usuarios.map((u) => (
            <div
              key={u.id}
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--r-xl)',
                padding: 16,
                border: '1px solid var(--line-soft)',
                opacity: u.activo ? 1 : 0.5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>{u.nombre}</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text-faint)', marginTop: 2 }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 'var(--r-full)',
                      fontSize: '.7rem',
                      fontWeight: 700,
                      background: u.rol === 'admin' ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'color-mix(in srgb, var(--cyan) 20%, transparent)',
                      color: u.rol === 'admin' ? 'var(--primary)' : 'var(--cyan)',
                      marginRight: 8,
                    }}>
                      {u.rol.toUpperCase()}
                    </span>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="icon-btn"
                    onClick={() => { setPinTarget(u); setPinOpen(true); setPinNuevo(''); setPinConfirm(''); setPinError(''); }}
                    title="Cambiar PIN"
                    style={{ width: 36, height: 36 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => handleExtender(u)}
                    title="Extender sesión 30 días"
                    style={{ width: 36, height: 36 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => handleRevocar(u)}
                    title="Revocar acceso"
                    style={{ width: 36, height: 36 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => handleToggleActivo(u)}
                    title={u.activo ? 'Desactivar' : 'Activar'}
                    style={{ width: 36, height: 36 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {u.activo
                        ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                        : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      }
                    </svg>
                  </button>
                </div>
              </div>
              <div style={{ fontSize: '.75rem', color: 'var(--text-dim)', marginTop: 8, display: 'flex', gap: 16 }}>
                <span>Dispositivo: {u.deviceId ? u.deviceId.slice(0, 8) + '...' : '—'}</span>
                <span>Último login: {formatDate(u.lastLoginAt)}</span>
                <span>Expira: {formatDate(u.sessionExpiresAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {crearOpen && (
        <div className="modal-overlay" onClick={() => setCrearOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Nuevo usuario</h2>
              <button className="modal-close" onClick={() => setCrearOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleCrearUsuario}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>NOMBRE</label>
                  <input
                    type="text"
                    value={crearNombre}
                    onChange={(e) => setCrearNombre(e.target.value)}
                    placeholder="Nombre del usuario"
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>PIN</label>
                  <input
                    type="password"
                    value={crearPin}
                    onChange={(e) => setCrearPin(e.target.value)}
                    placeholder="Mínimo 4 dígitos"
                    maxLength={6}
                    inputMode="numeric"
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none', letterSpacing: 6, textAlign: 'center' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>ROL</label>
                  <select
                    value={crearRol}
                    onChange={(e) => setCrearRol(e.target.value as RolUsuario)}
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }}
                  >
                    <option value="operador">Operador</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer (solo lectura)</option>
                  </select>
                </div>
                {crearError && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--r-lg)', background: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)', fontSize: '.85rem', textAlign: 'center' }}>
                    {crearError}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setCrearOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Crear usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pwdOpen && (
        <div className="modal-overlay" onClick={() => setPwdOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Cambiar mi contraseña</h2>
              <button className="modal-close" onClick={() => setPwdOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleCambiarPwd}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>NUEVA CONTRASEÑA</label>
                  <input
                    type="password"
                    value={pwdNueva}
                    onChange={(e) => setPwdNueva(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoFocus
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>CONFIRMAR</label>
                  <input
                    type="password"
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    placeholder="Repetir contraseña"
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1rem', color: 'var(--text)', outline: 'none' }}
                  />
                </div>
                {pwdError && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--r-lg)', background: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)', fontSize: '.85rem', textAlign: 'center' }}>
                    {pwdError}
                  </div>
                )}
                <p style={{ fontSize: '.75rem', color: 'var(--text-faint)' }}>Vas a tener que iniciar sesión de nuevo con el PIN + nueva contraseña.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setPwdOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar contraseña</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pinOpen && pinTarget && (
        <div className="modal-overlay" onClick={() => setPinOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Cambiar PIN de {pinTarget.nombre}</h2>
              <button className="modal-close" onClick={() => setPinOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleCambiarPin}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>NUEVO PIN</label>
                  <input
                    type="password"
                    value={pinNuevo}
                    onChange={(e) => setPinNuevo(e.target.value)}
                    placeholder="Mínimo 4 dígitos"
                    maxLength={6}
                    inputMode="numeric"
                    autoFocus
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1.5rem', color: 'var(--text)', outline: 'none', letterSpacing: 6, textAlign: 'center' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>CONFIRMAR</label>
                  <input
                    type="password"
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value)}
                    placeholder="Repetir PIN"
                    maxLength={6}
                    inputMode="numeric"
                    style={{ padding: '12px 14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line-soft)', background: 'var(--surface)', fontSize: '1.5rem', color: 'var(--text)', outline: 'none', letterSpacing: 6, textAlign: 'center' }}
                  />
                </div>
                {pinError && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--r-lg)', background: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)', fontSize: '.85rem', textAlign: 'center' }}>
                    {pinError}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setPinOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar PIN</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}