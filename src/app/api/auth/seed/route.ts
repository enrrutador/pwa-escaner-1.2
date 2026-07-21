// /api/auth/seed — crea admin Marcelo si no existe. Llamado desde el cliente al iniciar.
import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const list = await usersKv.listar();
    if (list.length === 0) {
      await usersKv.crear({
        correo: 'marcelo@stockmaster.local',
        nombre: 'Marcelo',
        password: 'Saturnoviamail1',
        rol: 'admin',
      });
      return NextResponse.json({ ok: true, seeded: true });
    }
    return NextResponse.json({ ok: true, seeded: false });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
