// /api/auth/validate — lee cookie httpOnly, valida sesion contra Redis.
import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';
import { leerCookieSesion } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const cookie = req.headers.get('cookie');
    const payload = leerCookieSesion(cookie);
    if (!payload) return NextResponse.json({ ok: false }, { status: 401 });

    const usuario = await usersKv.validarSesionPorDispositivo(payload.correo, payload.deviceId);
    if (!usuario) return NextResponse.json({ ok: false }, { status: 401 });

    return NextResponse.json({
      ok: true,
      usuario: {
        id: usuario.id,
        correo: usuario.correo,
        nombre: usuario.nombre,
        rol: usuario.rol,
        activo: usuario.activo,
        createdAt: usuario.createdAt,
        lastLoginAt: usuario.lastLoginAt,
        sessionExpiresAt: usuario.sessionExpiresAt,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
