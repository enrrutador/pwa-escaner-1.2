// /api/auth/logout — limpia sesion del usuario.
import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { correo } = await req.json();
    if (correo) await usersKv.cerrarSesion(correo);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
