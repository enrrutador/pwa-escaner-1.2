// /api/auth/logout — limpia sesion Redis + vacía cookie httpOnly.
import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';
import { vaciarCookieSesion } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { correo } = await req.json();
    if (correo) await usersKv.cerrarSesion(correo);
    const res = NextResponse.json({ ok: true });
    res.headers.set('Set-Cookie', vaciarCookieSesion());
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
