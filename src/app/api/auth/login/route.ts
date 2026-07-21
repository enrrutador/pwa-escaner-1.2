// /api/auth/login — valida contra Upstash Redis.
import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { correo, password, deviceId } = await req.json();
    if (!correo || !password || !deviceId) {
      return NextResponse.json({ ok: false, error: 'Faltan datos' }, { status: 400 });
    }
    const res = await usersKv.verificarPassword(correo, password, deviceId);
    if (!res.ok || !res.usuario) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 401 });
    }
    const sesion = await usersKv.iniciarSesion(correo, deviceId);
    return NextResponse.json({
      ok: true,
      usuario: sesion.usuario,
      sessionToken: sesion.sessionToken,
      expiraEn: sesion.expiraEn,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
