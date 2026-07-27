'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDeviceId } from '@/store/authStore';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError('Ingresá tu contraseña'); return; }
    setLoading(true);
    setError('');
    try {
      const deviceId = getDeviceId();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ correo: 'atenciafab@gmail.com', password, deviceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Error');
        return;
      }
      if (!data.usuario?.superAdmin) {
        setError('Acceso no autorizado');
        return;
      }
      router.replace('/admin');
    } catch {
      setError('Sin conexión al servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      background: '#0a0a0a',
    }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'white' }}>StockMaster</h1>
          <p style={{ color: '#888', marginTop: 4, fontSize: '.9rem' }}>Acceso de administración</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '.8rem', fontWeight: 600, color: '#666' }}>CONTRASEÑA</label>
            <input
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña de super-admin"
              autoFocus
              style={{
                padding: '14px 16px', borderRadius: 12,
                border: '1px solid #222', background: '#111',
                fontSize: '1rem', color: 'white', outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 12,
              background: 'rgba(220,38,38,0.15)', color: '#ef4444',
              fontSize: '.85rem', textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              padding: '14px', borderRadius: 12, border: 'none',
              background: loading ? '#222' : '#dc2626',
              color: loading ? '#666' : 'white',
              fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
