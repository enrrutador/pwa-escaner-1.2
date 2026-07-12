'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { dbAlertas } from '@/lib/db-alertas';
import { dbGlobal } from '@/lib/db-global';

function ToggleIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
}
function ScanIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>;
}
function WifiIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" x2="12.01" y1="20" y2="20"/></svg>;
}
function DatabaseIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>;
}
function UserIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function ChevronRight() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-faint)' }}><path d="m9 18 6-6-6-6"/></svg>;
}

export default function Ajustes() {
  const { usuario, logout } = useAuthStore();
  const [alertasNoLeidas, setAlertasNoLeidas] = useState(0);
  const [toggles, setToggles] = useState({ alertas: true, sonido: true, sincro: false });

  useEffect(() => {
    dbAlertas.contarNoLeidas().then(setAlertasNoLeidas);
  }, []);

  const toggle = (key: keyof typeof toggles) => {
    setToggles((t) => ({ ...t, [key]: !t[key] }));
  };

  const exportarDatos = async () => {
    const datos = await dbGlobal.exportarTodo();
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockmaster-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="screen active">
      <div>
        <p className="eyebrow">Ajustes</p>
        <h1 className="h-page">Configuración</h1>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="set-row" onClick={() => toggle('alertas')}>
          <ToggleIcon />
          <div className="s-body">
            <div className="s-name">Alertas de stock bajo</div>
            <div className="s-sub">Notificar bajo el mínimo ({alertasNoLeidas} sin leer)</div>
          </div>
          <div className={`toggle${toggles.alertas ? ' on' : ''}`} />
        </div>
        <div className="set-row" onClick={() => toggle('sonido')}>
          <ScanIcon />
          <div className="s-body">
            <div className="s-name">Sonido al escanear</div>
            <div className="s-sub">Confirmación audible</div>
          </div>
          <div className={`toggle${toggles.sonido ? ' on' : ''}`} />
        </div>
        <div className="set-row" onClick={() => toggle('sincro')}>
          <WifiIcon />
          <div className="s-body">
            <div className="s-name">Sincronización automática</div>
            <div className="s-sub">Cada 15 minutos</div>
          </div>
          <div className={`toggle${toggles.sincro ? ' on' : ''}`} />
        </div>
        <div className="set-row" onClick={exportarDatos}>
          <DatabaseIcon />
          <div className="s-body">
            <div className="s-name">Copia de seguridad</div>
            <div className="s-sub">Exportar datos (JSON)</div>
          </div>
          <ChevronRight />
        </div>
        <div className="set-row">
          <UserIcon />
          <div className="s-body">
            <div className="s-name">Cuenta</div>
            <div className="s-sub">{usuario?.nombre || 'Sin sesión'}</div>
          </div>
          <ChevronRight />
        </div>
        <div className="set-row" onClick={logout}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--danger)' }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          <div className="s-body">
            <div className="s-name" style={{ color: 'var(--danger)' }}>Cerrar sesión</div>
            <div className="s-sub">Salir de la cuenta</div>
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 20, fontSize: '.78rem', color: 'var(--text-faint)' }}>
        StockMaster v1.2.0 · Next.js 14 · Dexie.js
      </div>
    </div>
  );
}
