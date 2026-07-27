import { NextResponse } from 'next/server';
import { tenantsKv } from '@/lib/server/tenants-kv';
import { leerCookieSesion } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPER_ADMIN = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'atenciafab@gmail.com';

async function authSuperAdmin(req: Request) {
  const payload = await leerCookieSesion(req.headers.get('cookie'));
  if (!payload) return false;
  return payload.correo === SUPER_ADMIN;
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await authSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    await tenantsKv.desactivar(params.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
