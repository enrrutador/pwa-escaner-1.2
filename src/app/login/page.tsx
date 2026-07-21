'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, getDeviceId } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { login, usuario, inicializado } = useAuthStore();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (usuario && inicializado) router.replace('/');
  }, [usuario, inicializado, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correo.trim() || !password) {
      setError('Completá correo y contraseña');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const deviceId = getDeviceId();
      const res = await login(correo.trim(), password, deviceId);
      if (res.ok) router.replace('/');
      else setError(res.error || 'Error al iniciar sesión');
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
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 32 }}>
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
          <p style={{ color: 'var(--text-faint)', marginTop: 4, fontSize: '.9rem' }}>Ingresá con tu correo y contraseña</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>CORREO</label>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="nombre@correo.com"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{
                padding: '14px 16px', borderRadius: 'var(--r-lg)',
                border: '1px solid var(--line-soft)', background: 'var(--surface)',
                fontSize: '1rem', color: 'var(--text)', outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>CONTRASEÑA</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              style={{
                padding: '14px 16px', borderRadius: 'var(--r-lg)',
                border: '1px solid var(--line-soft)', background: 'var(--surface)',
                fontSize: '1rem', color: 'var(--text)', outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 'var(--r-lg)',
              background: 'color-mix(in srgb, var(--warn) 15%, transparent)',
              color: 'var(--warn)', fontSize: '.85rem', textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px', borderRadius: 'var(--r-lg)', border: 'none',
              background: loading ? 'var(--surface)' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-strong) 100%)',
              color: loading ? 'var(--text-faint)' : 'var(--on-primary)',
              fontSize: '1rem', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity .2s',
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
