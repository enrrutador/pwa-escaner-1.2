import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';
import { leerCookieSesion } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPER_ADMIN = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'atenciafab@gmail.com';

export async function POST(req: Request) {
  try {
    const cookie = req.headers.get('cookie');
    const payload = await leerCookieSesion(cookie);
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
        superAdmin: usuario.correo === SUPER_ADMIN,
        tenantId: usuario.tenantId,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
