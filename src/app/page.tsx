'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/utils';
import { useProductos } from '@/hooks/useProductos';
import { dbAlertas } from '@/lib/db-alertas';
import { dbConteos } from '@/lib/db-conteos';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

export default function Dashboard() {
  const { usuario, inicializado, inicializar, login } = useAuthStore();
  const { mostrarToast } = useUIStore();
  const { productos, cargando: cargandoProd, recargar: recargarProd } = useProductos({ limite: 5 });
  const [alertasNoLeidas, setAlertasNoLeidas] = useState(0);
  const [conteosAbiertos, setConteosAbiertos] = useState(0);
  const [loginForm, setLoginForm] = useState({ nombre: '', pin: '' });
  const [logueando, setLogueando] = useState(false);

  useEffect(() => {
    inicializar();
  }, [inicializar]);

  useEffect(() => {
    if (!inicializado) return;
    dbAlertas.contarNoLeidas().then(setAlertasNoLeidas);
    dbConteos.listar().then((c) => setConteosAbiertos(c.filter((x) => x.estado === 'abierto' || x.estado === 'en_progreso').length));
  }, [inicializado]);

  if (!inicializado) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-navy-800 rounded" />
          <div className="h-4 w-64 bg-navy-800 rounded" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-navy-700 bg-navy-900/50 animate-pulse">
              <div className="h-4 w-24 bg-navy-800 rounded mb-2" />
              <div className="h-12 w-16 bg-navy-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="max-w-md mx-auto mt-20 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">StockMaster</h1>
          <p className="text-zinc-400">Iniciar sesión</p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLogueando(true);
            const res = await login(loginForm.nombre, loginForm.pin);
            if (!res.ok) {
              mostrarToast('error', res.error || 'Error al iniciar sesión');
            }
            setLogueando(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Usuario</label>
            <input
              type="text"
              value={loginForm.nombre}
              onChange={(e) => setLoginForm({ ...loginForm, nombre: e.target.value })}
              className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
              placeholder="Marcelo"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">PIN</label>
            <input
              type="password"
              value={loginForm.pin}
              onChange={(e) => setLoginForm({ ...loginForm, pin: e.target.value })}
              className="w-full px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
              placeholder="1234"
              required
            />
          </div>
          <button
            type="submit"
            disabled={logueando}
            className="w-full py-3 bg-cyan-500 text-navy-950 font-semibold rounded-xl hover:bg-cyan-400 disabled:opacity-50"
          >
            {logueando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="text-center text-zinc-500 text-sm">
          Demo: <strong>Marcelo</strong> / <strong>1234</strong>
        </p>
      </div>
    );
  }

  const stats = [
    { label: 'Productos', valor: productos.length, icon: '📦', color: 'border-l-4 border-cyan-500' },
    { label: 'Alertas', valor: alertasNoLeidas, icon: '⚠️', color: 'border-l-4 border-orange-500' },
    { label: 'Conteos abiertos', valor: conteosAbiertos, icon: '📋', color: 'border-l-4 border-orange-500' },
    { label: 'Stock crítico', valor: productos.filter(p => p.stockActual <= p.stockMinimo).length, icon: '🔴', color: 'border-l-4 border-red-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-zinc-400 text-sm">Bienvenido, {usuario.nombre}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className={`p-4 rounded-xl border border-navy-700 bg-navy-900/50 ${stat.color}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide opacity-80">{stat.label}</p>
                <p className="text-3xl font-bold mt-1">{stat.valor}</p>
              </div>
              <span className="text-3xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-navy-700 bg-navy-900/50 p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <span>⚠️</span> Alertas sin leer: {alertasNoLeidas}
          </h2>
          {alertasNoLeidas > 0 ? (
            <Link
              href="/ajustes"
              className="inline-flex items-center gap-2 px-3 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
            >
              Ver alertas →
            </Link>
          ) : (
            <p className="text-zinc-500 text-sm">Todo tranquilo</p>
          )}
        </section>

        <section className="rounded-xl border border-navy-700 bg-navy-900/50 p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <span>📋</span> Conteos abiertos: {conteosAbiertos}
          </h2>
          {conteosAbiertos > 0 ? (
            <Link
              href="/historial"
              className="inline-flex items-center gap-2 px-3 py-2 bg-orange-500/20 text-orange-400 rounded-lg text-sm hover:bg-orange-500/30 transition-colors"
            >
              Continuar conteo →
            </Link>
          ) : (
            <p className="text-zinc-500 text-sm">No hay conteos en progreso</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-navy-700 bg-navy-900/50 p-4">
        <h2 className="font-semibold mb-3">Productos recientes</h2>
        {cargandoProd ? (
          <p className="text-zinc-500">Cargando...</p>
        ) : productos.length === 0 ? (
          <p className="text-zinc-500">No hay productos. Agregá uno desde Inventario.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-navy-700">
                  <th className="pb-2 pr-4">PLU</th>
                  <th className="pb-2 pr-4">Producto</th>
                  <th className="pb-2 pr-4">Stock</th>
                  <th className="pb-2 pr-4">Precio</th>
                </tr>
              </thead>
              <tbody>
                {productos.slice(0, 5).map((p) => (
                  <tr key={p.id} className="border-b border-navy-800 last:border-0 hover:bg-navy-800/50">
                    <td className="py-2 pr-4 font-mono text-cyan-400">{p.plu}</td>
                    <td className="py-2 pr-4">
                      <Link href={`/producto/${p.id}`} className="hover:text-cyan-400 transition-colors">
                        {p.nombre}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={p.stockActual <= p.stockMinimo ? 'text-orange-400' : ''}>
                        {p.stockActual}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{formatMoney(p.precioVenta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
