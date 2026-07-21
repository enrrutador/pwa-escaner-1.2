// /api/admin/usuarios/[correo] — PUT actualiza password del usuario.
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

export async function PUT(req: Request, { params }: { params: { correo: string } }) {
  try {
    if (!(await authAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const correo = decodeURIComponent(params.correo).toLowerCase();
    const { password } = await req.json();
    if (!password) return NextResponse.json({ ok: false, error: 'Falta password' }, { status: 400 });
    await usersKv.actualizarPassword(correo, password);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
