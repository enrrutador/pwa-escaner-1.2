import { NextResponse } from 'next/server';
import { tenantsKv } from '@/lib/server/tenants-kv';
import { leerCookieSesion } from '@/lib/server/session';
import { crearTenantSchema } from '@/lib/server/schemas';

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
    if (!(await authSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const list = await tenantsKv.listar();
    return NextResponse.json({ ok: true, tenants: list });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await authSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const body = await req.json();
    const parsed = crearTenantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 },
      );
    }
    const tenant = await tenantsKv.crear(parsed.data);
    return NextResponse.json({ ok: true, tenant });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
