// /api/auth/validate — valida sesión activa contra Redis.
import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { correo, deviceId, sessionToken } = await req.json();
    if (!correo || !deviceId || !sessionToken) {
      return NextResponse.json({ ok: false, error: 'Faltan datos' }, { status: 400 });
    }
    const ok = await usersKv.validarSesion(correo, deviceId, sessionToken);
    if (!ok) return NextResponse.json({ ok: false }, { status: 401 });
    const usuario = await usersKv.obtener(correo);
    if (!usuario || !usuario.activo) return NextResponse.json({ ok: false }, { status: 401 });
    return NextResponse.json({ ok: true, usuario });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
