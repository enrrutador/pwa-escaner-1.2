'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FloatingScannerFab } from '@/components/common/FloatingScannerFab';
import { useAuthStore } from '@/store/authStore';
import { useScraperStore } from '@/store/scraperStore';

const NAV = [
  { href: '/', label: 'PANEL', icon: 'layout-dashboard' },
  { href: '/inventario', label: 'INVENTARIO', icon: 'list' },
  { href: '/historial', label: 'HISTORIAL', icon: 'history' },
  { href: '/ajustes', label: 'AJUSTES', icon: 'settings' },
];

function TopBar({ pathname }: { pathname: string }) {
  const { usuario, esSuperAdmin, logout } = useAuthStore();
  const scraper = useScraperStore();
  const router = useRouter();
  const titles: Record<string, { icon: string; text: string; mode: 'brand' | 'title' }> = {
    '/': { icon: 'boxes', text: 'StockMaster', mode: 'brand' },
    '/inventario': { icon: 'package-2', text: 'PRODUCTOS', mode: 'title' },
    '/inventario/nuevo': { icon: 'package-2', text: 'NUEVO PRODUCTO', mode: 'title' },
    '/scanner': { icon: 'scan-barcode', text: 'ESCANEAR', mode: 'title' },
    '/historial': { icon: 'boxes', text: 'StockMaster', mode: 'brand' },
    '/ajustes': { icon: 'boxes', text: 'StockMaster', mode: 'brand' },
    '/admin': { icon: 'shield', text: 'ADMIN', mode: 'title' },
  };

  const cfg = titles[pathname] || titles['/'];
  const isProductDetail = pathname.startsWith('/producto/');

  const scraperColor = scraper.estado === 'procesando'
    ? 'var(--primary)'
    : scraper.estado === 'finalizado'
    ? '#16a34a'
    : 'currentColor';
  const scraperTitle = scraper.estado === 'procesando'
    ? `Completando datos... ${scraper.procesados}/${scraper.total} (${scraper.completados} enriquecidos)`
    : scraper.estado === 'finalizado'
    ? `Datos completados: ${scraper.completados} productos enriquecidos`
    : 'StockMaster';

  return (
    <header className="topbar">
      {cfg.mode === 'brand' ? (
        <>
          <button
            className="icon-btn"
            aria-label="Estado del scraper"
            title={scraperTitle}
            style={{
              color: scraperColor,
              transition: 'color .3s',
              animation: scraper.estado === 'procesando' ? 'pulse-scraper 1.5s ease-in-out infinite' : 'none',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
          </button>
          <div className="brand" style={{ color: scraperColor, transition: 'color .3s' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            StockMaster
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {esSuperAdmin() && (
              <Link href="/admin" className="icon-btn" aria-label="Admin" title="Panel admin">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
              </Link>
            )}
            <button
              className="icon-btn"
              aria-label="Cerrar sesión"
              title={`Cerrar sesión (${usuario?.nombre || ''})`}
              onClick={async () => { await logout(); router.replace('/login'); }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            </button>
          </div>
        </>
      ) : isProductDetail ? (
        <>
          <Link href="/inventario" className="icon-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
          <h1>FICHA TÉCNICA</h1>
          <button className="icon-btn" aria-label="Alertas">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </button>
        </>
      ) : (
        <>
          <Link href="/" className="icon-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
          <h1>{cfg.text}</h1>
          <button className="icon-btn" aria-label="Alertas">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </button>
        </>
      )}
    </header>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="bottomnav">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-btn${pathname === item.href ? ' active' : ''}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {item.icon === 'layout-dashboard' && <><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></>}
            {item.icon === 'list' && <><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></>}
            {item.icon === 'history' && <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></>}
            {item.icon === 'settings' && <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></>}
          </svg>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { usuario, inicializado } = useAuthStore();

  useEffect(() => {
    if (!inicializado) return;
    if (!usuario && pathname !== '/login') {
      router.replace('/login');
    }
    if (usuario && pathname === '/login') {
      router.replace('/');
    }
  }, [inicializado, usuario, pathname, router]);

  if (!usuario && pathname !== '/login' && inicializado) {
    return null;
  }

  return (
    <div className="app">
      <TopBar pathname={pathname} />
      <main>
        {children}
      </main>
      <FloatingScannerFab />
      <BottomNav pathname={pathname} />
    </div>
  );
}
