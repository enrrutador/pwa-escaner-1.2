'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/utils';
import { useProductos } from '@/hooks/useProductos';
import { dbAlertas } from '@/lib/db-alertas';
import { dbConteos } from '@/lib/db-conteos';
import { useAuthStore } from '@/store/authStore';

export default function Dashboard() {
  const { usuario, inicializado, inicializar } = useAuthStore();
  const { productos, cargando: cargandoProd, recargar: recargarProd } = useProductos({ limite: 5 });
  const [alertasNoLeidas, setAlertasNoLeidas] = useState(0);
  const [conteosAbiertos, setConteosAbiertos] = useState(0);

  useEffect(() => {
    inicializar();
  }, [inicializar]);

  useEffect(() => {
    if (!inicializado) return;
    dbAlertas.contarNoLeidas().then(setAlertasNoLeidas);
    dbConteos.listar().then((c) => setConteosAbiertos(c.filter((x) => x.estado === 'abierto' || x.estado === 'en_progreso').length));
  }, [inicializado]);

  if (!inicializado || !usuario) return null;

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
