import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';
import { leerCookieSesion } from '@/lib/server/session';
import { ratelimitAdmin, clientIp, checkRatelimit } from '@/lib/server/ratelimit';
import { crearUsuarioSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPER_ADMIN = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'atenciafab@gmail.com';

async function authSuperAdmin(req: Request) {
  const payload = await leerCookieSesion(req.headers.get('cookie'));
  if (!payload) return false;
  return payload.correo === SUPER_ADMIN;
}

export async function GET(req: Request) {
  try {
    const ip = clientIp(req);
    const rl = await checkRatelimit(ratelimitAdmin, ip);
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: 'Rate limit' }, { status: 429 });
    }
    if (!(await authSuperAdmin(req))) {
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
      tenantId: u.tenantId,
      telefono: u.telefono,
      notas: u.notas,
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
    if (!(await authSuperAdmin(req))) {
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
    const { correo, nombre, password, rol, tenantId, telefono, notas } = parsed.data;
    const nuevo = await usersKv.crear({ correo, nombre, password, rol, tenantId, telefono, notas });
    return NextResponse.json({
      ok: true,
      usuario: { id: nuevo.id, correo: nuevo.correo, nombre: nuevo.nombre, rol: nuevo.rol, tenantId: nuevo.tenantId, createdAt: nuevo.createdAt },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

