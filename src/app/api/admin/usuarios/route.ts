// /api/admin/usuarios — GET lista usuarios, POST crea nuevo.
// Autorización: se valida que el caller sea admin con sesión válida contra Redis.
import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authAdmin(req: Request): Promise<boolean> {
  const correo = req.headers.get('x-user-correo');
  const token = req.headers.get('x-user-token');
  const deviceId = req.headers.get('x-user-device');
  if (!correo || !token || !deviceId) return false;
  const ok = await usersKv.validarSesion(correo, deviceId, token);
  if (!ok) return false;
  const u = await usersKv.obtener(correo);
  return !!u && u.rol === 'admin' && u.activo;
}

export async function GET(req: Request) {
  try {
    if (!(await authAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const list = await usersKv.listar();
    // No devolvemos passwordHash al cliente.
    const safe = list.map((u) => ({
      id: u.id,
      correo: u.correo,
      nombre: u.nombre,
      rol: u.rol,
      activo: u.activo,
      createdAt: u.createdAt,
      deviceId: u.deviceId,
      lastLoginAt: u.lastLoginAt,
      sessionExpiresAt: u.sessionExpiresAt,
    }));
    return NextResponse.json({ ok: true, usuarios: safe });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await authAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const { correo, nombre, password, rol } = await req.json();
    if (!correo || !nombre || !password || !rol) {
      return NextResponse.json({ ok: false, error: 'Faltan datos' }, { status: 400 });
    }
    if (!['admin', 'operador', 'viewer'].includes(rol)) {
      return NextResponse.json({ ok: false, error: 'Rol inválido' }, { status: 400 });
    }
    const nuevo = await usersKv.crear({ correo, nombre, password, rol });
    return NextResponse.json({ ok: true, usuario: nuevo });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
