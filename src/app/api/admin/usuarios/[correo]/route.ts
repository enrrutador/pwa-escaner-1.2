// /api/admin/usuarios/[correo] — PUT actualiza password, DELETE desvincula dispositivo.
import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';
import { leerCookieSesion } from '@/lib/server/session';
import { cambiarPasswordSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authAdmin(req: Request) {
  const payload = leerCookieSesion(req.headers.get('cookie'));
  if (!payload || payload.rol !== 'admin') return false;
  const u = await usersKv.obtener(payload.correo);
  return !!u && u.rol === 'admin' && u.activo;
}

export async function PUT(req: Request, { params }: { params: { correo: string } }) {
  try {
    if (!(await authAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const correo = decodeURIComponent(params.correo).toLowerCase();
    const body = await req.json();
    const parsed = cambiarPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 },
      );
    }
    await usersKv.actualizarPassword(correo, parsed.data.password);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { correo: string } }) {
  try {
    if (!(await authAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const correo = decodeURIComponent(params.correo).toLowerCase();
    await usersKv.limpiarDispositivo(correo);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
