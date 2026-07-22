// /api/admin/usuarios — GET lista usuarios, POST crea nuevo.
// Autorización: cookie httpOnly firmada (sm_session) + rol admin.
// Rate limited: 10 por IP por minuto.
import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';
import { leerCookieSesion } from '@/lib/server/session';
import { ratelimitAdmin, clientIp, checkRatelimit } from '@/lib/server/ratelimit';
import { crearUsuarioSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authAdmin(req: Request) {
  const payload = await leerCookieSesion(req.headers.get('cookie'));
  if (!payload || payload.rol !== 'admin') return false;
  const u = await usersKv.obtener(payload.correo);
  return !!u && u.rol === 'admin' && u.activo;
}

export async function GET(req: Request) {
  try {
    const ip = clientIp(req);
    const rl = await checkRatelimit(ratelimitAdmin, ip);
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: 'Rate limit' }, { status: 429 });
    }
    if (!(await authAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const list = await usersKv.listar();
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
    const ip = clientIp(req);
    const rl = await checkRatelimit(ratelimitAdmin, ip);
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: 'Rate limit' }, { status: 429 });
    }
    if (!(await authAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const body = await req.json();
    const parsed = crearUsuarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 },
      );
    }
    const { correo, nombre, password, rol } = parsed.data;
    const nuevo = await usersKv.crear({ correo, nombre, password, rol });
    return NextResponse.json({
      ok: true,
      usuario: { id: nuevo.id, correo: nuevo.correo, nombre: nuevo.nombre, rol: nuevo.rol, createdAt: nuevo.createdAt },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

