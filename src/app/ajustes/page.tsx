'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { dbUsuarios } from '@/lib/db-usuarios';
import { dbAlertas } from '@/lib/db-alertas';
import { dbGlobal } from '@/lib/db-global';
import { dbProductos } from '@/lib/db-productos';

export default function Ajustes() {
  const { usuario, tienePermiso, logout } = useAuthStore();
  const { mostrarToast } = useUIStore();
  const puedeGestionarUsuarios = tienePermiso('usuarios:gestionar');
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [alertasNoLeidas, setAlertasNoLeidas] = useState(0);
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', pin: '', rol: 'operador' as const });
  const [editando, setEditando] = useState<string | null>(null);

  useEffect(() => {
    if (puedeGestionarUsuarios) dbUsuarios.listar().then(setUsuarios);
    dbAlertas.contarNoLeidas().then(setAlertasNoLeidas);
  }, [puedeGestionarUsuarios]);

  const crearUsuario = async () => {
    if (!nuevoUsuario.nombre || !nuevoUsuario.pin) return;
    try {
      await dbUsuarios.crear(nuevoUsuario);
      setUsuarios(await dbUsuarios.listar());
      setNuevoUsuario({ nombre: '', pin: '', rol: 'operador' });
      mostrarToast('exito', 'Usuario creado');
    } catch (e: any) {
      mostrarToast('error', e.message);
    }
  };

  const actualizarUsuario = async (id: string, data: any) => {
    try {
      await dbUsuarios.actualizar(id, data);
      setUsuarios(await dbUsuarios.listar());
      setEditando(null);
      mostrarToast('exito', 'Usuario actualizado');
    } catch (e: any) {
      mostrarToast('error', e.message);
    }
  };

  const eliminarUsuario = async (id: string) => {
    if (id === usuario?.id) {
      mostrarToast('error', 'No podés eliminarte a vos mismo');
      return;
    }
    if (!confirm('Eliminar este usuario?')) return;
    try {
      await dbUsuarios.eliminar(id);
      setUsuarios(await dbUsuarios.listar());
      mostrarToast('exito', 'Usuario eliminado');
    } catch (e: any) {
      mostrarToast('error', e.message);
    }
  };

  const exportarDatos = async () => {
    try {
      const datos = await dbGlobal.exportarTodo();
      const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stockmaster-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      mostrarToast('exito', 'Backup exportado');
    } catch (e: any) {
      mostrarToast('error', e.message);
    }
  };

  const limpiarTodo = async () => {
    if (!confirm('ESTO BORRA TODO. ¿Seguro?')) return;
    if (!confirm('Confirmación final: se pierde TODO.')) return;
    try {
      await dbGlobal.limpiarTodo();
      logout();
      mostrarToast('exito', 'Base de datos limpiada');
    } catch (e: any) {
      mostrarToast('error', e.message);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Ajustes</h1>

      {puedeGestionarUsuarios && (
        <section className="bg-navy-900/50 border border-navy-700 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Usuarios</h2>

          <div className="bg-navy-800/50 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-medium">Crear usuario</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                value={nuevoUsuario.nombre}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })}
                placeholder="Nombre"
                className="px-3 py-2 bg-navy-900 border border-navy-700 rounded-lg focus:ring-cyan-500 focus:border-transparent"
              />
              <input
                type="password"
                value={nuevoUsuario.pin}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, pin: e.target.value })}
                placeholder="PIN (4+ dígitos)"
                className="px-3 py-2 bg-navy-900 border border-navy-700 rounded-lg focus:ring-cyan-500 focus:border-transparent"
              />
              <select
                value={nuevoUsuario.rol}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value as any })}
                className="px-3 py-2 bg-navy-900 border border-navy-700 rounded-lg focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="operador">Operador</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              onClick={crearUsuario}
              className="px-4 py-2 bg-cyan-500 text-navy-950 font-semibold rounded-lg hover:bg-cyan-400"
            >
              Crear
            </button>
          </div>

          <div className="space-y-2">
            {usuarios.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3 bg-navy-800/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.nombre}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      u.rol === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                      u.rol === 'operador' ? 'bg-cyan-500/20 text-cyan-400' :
                      'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {u.rol}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${u.activo ? 'bg-green-400' : 'bg-red-400'}`} />
                  </div>
                  <p className="text-xs text-zinc-500">Creado: {new Date(u.createdAt).toLocaleDateString('es-AR')}</p>
                </div>
                {editando === u.id ? (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Nuevo PIN (vacío = no cambia)"
                      className="px-3 py-2 bg-navy-900 border border-navy-700 rounded-lg w-40"
                      onKeyDown={(e) => e.key === 'Enter' && actualizarUsuario(u.id, { pin: e.currentTarget.value })}
                    />
                    <button onClick={() => actualizarUsuario(u.id, { pin: '' })} className="px-3 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 text-sm">Guardar</button>
                    <button onClick={() => setEditando(null)} className="px-3 py-2 bg-navy-700 text-zinc-400 rounded-lg hover:bg-navy-600 text-sm">Cancelar</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditando(u.id)} className="px-3 py-1.5 text-zinc-400 hover:text-cyan-400 text-sm">Cambiar PIN</button>
                    <button onClick={() => eliminarUsuario(u.id)} disabled={u.id === usuario?.id} className="px-3 py-1.5 text-red-400 hover:text-red-300 text-sm disabled:opacity-50">Eliminar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-navy-900/50 border border-navy-700 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Alertas</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="w-3 h-3 rounded-full bg-red-400" title="Sin stock" />
            <span>Sin stock: {alertasNoLeidas > 0 ? '⚠️ Hay alertas' : 'OK'}</span>
          </div>
          <button
            onClick={async () => {
              await dbAlertas.marcarTodasLeidas();
              setAlertasNoLeidas(0);
              mostrarToast('exito', 'Alertas marcadas como leídas');
            }}
            className="px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 text-sm"
          >
            Marcar todas como leídas
          </button>
        </div>
      </section>

      <section className="bg-navy-900/50 border border-navy-700 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Datos</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportarDatos}
            className="px-4 py-2 bg-navy-800 border border-navy-700 rounded-lg text-zinc-300 hover:bg-navy-700"
          >
            📥 Exportar backup (JSON)
          </button>
          <button
            onClick={limpiarTodo}
            className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30"
          >
            🗑️ Limpiar TODO
          </button>
        </div>
      </section>

      <section className="bg-navy-900/50 border border-navy-700 rounded-xl p-6 space-y-2">
        <h2 className="font-semibold">Versión</h2>
        <p className="text-zinc-500 text-sm">StockMaster v1.2.0</p>
        <p className="text-zinc-500 text-sm">Next.js 14 · Dexie.js · Zustand · Tailwind v4</p>
      </section>
    </div>
  );
}
