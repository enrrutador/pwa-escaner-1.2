'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { dbUsuarios } from '@/lib/db-usuarios';
import { canjearInvitacion } from '@/lib/invitaciones';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let deviceId = localStorage.getItem('stockmaster-device-id');
  if (!deviceId) {
    deviceId = uid();
    localStorage.setItem('stockmaster-device-id', deviceId);
  }
  return deviceId;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, usuario, inicializado } = useAuthStore();
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [esAdmin, setEsAdmin] = useState(false);

  // Canjear código de invitación
  const [canjearOpen, setCanjearOpen] = useState(false);
  const [canjearCodigo, setCanjearCodigo] = useState('');
  const [canjearError, setCanjearError] = useState('');
  const [canjearLoading, setCanjearLoading] = useState(false);
  const [canjearOk, setCanjearOk] = useState<{ nombre: string } | null>(null);

  const handleCanjear = async (e: React.FormEvent) => {
    e.preventDefault();
    setCanjearError('');
    if (!canjearCodigo.trim()) { setCanjearError('Pegá el código'); return; }
    setCanjearLoading(true);
    try {
      const deviceId = getDeviceId();
      const res = await canjearInvitacion(canjearCodigo.trim(), deviceId);
      if (!res.ok || !res.usuario) {
        setCanjearError(res.error || 'No se pudo canjear');
        return;
      }
      setCanjearOk({ nombre: res.usuario.nombre });
      setCanjearCodigo('');
    } catch (err: any) {
      setCanjearError(err.message || 'Error inesperado');
    } finally {
      setCanjearLoading(false);
    }
  };

  useEffect(() => {
    if (usuario && inicializado) {
      router.replace('/');
    }
  }, [usuario, inicializado, router]);

  // Detectar si el nombre ingresado corresponde a un admin
  useEffect(() => {
    if (!nombre.trim() || !inicializado) {
      setEsAdmin(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const u = await dbUsuarios.obtenerPorNombre(nombre.trim());
      if (!cancelled) {
        setEsAdmin(u?.rol === 'admin' && !!u?.passwordHash);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [nombre, inicializado]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !pin.trim()) {
      setError('Completá todos los campos');
      return;
    }
    if (esAdmin && !password) {
      setError('Contraseña requerida');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const deviceId = getDeviceId();
      const res = await login(
        nombre.trim(),
        pin.trim(),
        deviceId,
        esAdmin ? password : undefined,
      );
      if (res.ok) {
        router.replace('/');
      } else {
        setError(res.error || 'Error al iniciar sesión');
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--r-full)',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-strong) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>StockMaster</h1>
          <p style={{ color: 'var(--text-faint)', marginTop: 4, fontSize: '.9rem' }}>Ingresá con tu usuario y PIN</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>USUARIO</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Marcelo"
              autoFocus
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--line-soft)',
                background: 'var(--surface)',
                fontSize: '1rem',
                color: 'var(--text)',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              maxLength={6}
              inputMode="numeric"
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--line-soft)',
                background: 'var(--surface)',
                fontSize: '1.5rem',
                letterSpacing: 8,
                color: 'var(--text)',
                outline: 'none',
                textAlign: 'center',
              }}
            />
          </div>

          {esAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, animation: 'fadeIn .2s ease' }}>
              <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--primary)' }}>CONTRASEÑA (ADMIN)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña de admin"
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--r-lg)',
                  border: '1px solid var(--primary)',
                  background: 'color-mix(in srgb, var(--primary) 5%, var(--surface))',
                  fontSize: '1rem',
                  color: 'var(--text)',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {error && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--r-lg)',
              background: 'color-mix(in srgb, var(--warn) 15%, transparent)',
              color: 'var(--warn)',
              fontSize: '.85rem',
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px',
              borderRadius: 'var(--r-lg)',
              border: 'none',
              background: loading ? 'var(--surface)' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-strong) 100%)',
              color: loading ? 'var(--text-faint)' : 'var(--on-primary)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity .2s',
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <button
          onClick={() => { setCanjearOpen(true); setCanjearError(''); setCanjearOk(null); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--primary)', fontSize: '.85rem',
            padding: 8, marginTop: -8,
          }}
        >
          ¿Tenés código de invitación?
        </button>
      </div>

      {canjearOpen && (
        <div className="modal-overlay" onClick={() => setCanjearOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Canjear código de invitación</h2>
              <button className="modal-close" onClick={() => setCanjearOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {canjearOk ? (
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', padding: 24, textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 'var(--r-full)', background: 'color-mix(in srgb, var(--success) 20%, transparent)', display: 'grid', placeItems: 'center', color: 'var(--success)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>¡Cuenta cargada!</div>
                  <div style={{ fontSize: '.85rem', color: 'var(--text-faint)', marginTop: 4 }}>
                    Ahora podés ingresar como <strong>{canjearOk.nombre}</strong> con tu PIN.
                  </div>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setCanjearOpen(false);
                    setCanjearOk(null);
                    setNombre(canjearOk.nombre);
                  }}
                >
                  Cerrar y entrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleCanjear}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontSize: '.85rem', color: 'var(--text-dim)', margin: 0 }}>
                    Pegá el código que te pasó el admin. Tu cuenta se va a cargar en este dispositivo.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>CÓDIGO</label>
                    <textarea
                      value={canjearCodigo}
                      onChange={(e) => setCanjearCodigo(e.target.value)}
                      placeholder="STK1-..."
                      autoFocus
                      rows={3}
                      style={{
                        padding: '12px 14px', borderRadius: 'var(--r-lg)',
                        border: '1px solid var(--line-soft)', background: 'var(--surface)',
                        fontSize: '.8rem', fontFamily: 'monospace', color: 'var(--text)',
                        outline: 'none', resize: 'none', wordBreak: 'break-all',
                      }}
                    />
                  </div>
                  {canjearError && (
                    <div style={{ padding: '10px 14px', borderRadius: 'var(--r-lg)', background: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)', fontSize: '.85rem', textAlign: 'center' }}>
                      {canjearError}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-ghost" onClick={() => setCanjearOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={canjearLoading}>
                    {canjearLoading ? 'Cargando...' : 'Cargar cuenta'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
