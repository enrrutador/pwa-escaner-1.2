// /api/auth/login — valida contra Redis, firma cookie httpOnly, registra deviceId en Redis.
// Rate limited: 5 intentos por IP por minuto.
import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';
import { crearCookieSesion } from '@/lib/server/session';
import { ratelimitLogin, clientIp, checkRatelimit } from '@/lib/server/ratelimit';
import { loginSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const rl = await checkRatelimit(ratelimitLogin, ip);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: 'Demasiados intentos. Esperá un minuto.' },
        { status: 429 },
      );
    }
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 },
      );
    }
    const { correo, password, deviceId } = parsed.data;
    const res = await usersKv.verificarPassword(correo, password, deviceId);
    if (!res.ok || !res.usuario) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 401 });
    }
    const sesion = await usersKv.iniciarSesion(correo, deviceId);

    const cookie = await crearCookieSesion({
      correo,
      deviceId,
      rol: sesion.usuario.rol,
      exp: sesion.expiraEn,
    });

    const res2 = NextResponse.json({
      ok: true,
      usuario: {
        id: sesion.usuario.id,
        correo: sesion.usuario.correo,
        nombre: sesion.usuario.nombre,
        rol: sesion.usuario.rol,
        activo: sesion.usuario.activo,
        createdAt: sesion.usuario.createdAt,
        lastLoginAt: sesion.usuario.lastLoginAt,
        sessionExpiresAt: sesion.usuario.sessionExpiresAt,
      },
    });
    res2.headers.set('Set-Cookie', cookie);
    return res2;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

