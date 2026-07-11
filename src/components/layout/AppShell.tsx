'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { FloatingScannerFab } from '@/components/common/FloatingScannerFab';
import { ToastViewport } from '@/components/common/ToastViewport';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/inventario', label: 'Inventario', icon: '📦' },
  { href: '/scanner', label: 'Escanear', icon: '📷' },
  { href: '/historial', label: 'Historial', icon: '📜' },
  { href: '/ajustes', label: 'Ajustes', icon: '⚙️' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { usuario, logout, inicializar } = useAuthStore();
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-navy-900/95 backdrop-blur border-b border-navy-700">
        <div className="flex h-full items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-cyan-400">
            <span className="text-xl">📦</span>
            <span>StockMaster</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  pathname === item.href
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-navy-800'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {usuario && (
              <>
                <span className="hidden sm:block text-xs text-zinc-500">
                  {usuario.nombre} · {usuario.rol}
                </span>
                <button
                  onClick={logout}
                  className="text-xs text-zinc-400 hover:text-orange-500"
                >
                  Salir
                </button>
              </>
            )}
            <button
              onClick={() => setMenuAbierto(!menuAbierto)}
              className="md:hidden p-2 rounded-lg text-zinc-400 hover:bg-navy-800"
              aria-label="Menú"
            >
              {menuAbierto ? '✕' : '☰'}
            </button>
          </div>
        </div>
        {menuAbierto && (
          <nav className="md:hidden px-4 pb-4 border-t border-navy-700">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuAbierto(false)}
                className={`block px-3 py-2 rounded-lg text-sm ${
                  pathname === item.href
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-navy-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="pt-16 pb-24 px-4 max-w-5xl mx-auto">
        {children}
      </main>

      <FloatingScannerFab />
      <ToastViewport />
    </>
  );
}
