import { NextResponse } from 'next/server';
import { tenantsKv } from '@/lib/server/tenants-kv';
import { leerCookieSesion } from '@/lib/server/session';
import { editarTenantSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPER_ADMIN = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'atenciafab@gmail.com';

async function authSuperAdmin(req: Request) {
  const payload = await leerCookieSesion(req.headers.get('cookie'));
  if (!payload) return false;
  return payload.correo === SUPER_ADMIN;
}

// PATCH: editar tenant
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await authSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const body = await req.json();
    const parsed = editarTenantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 },
      );
    }
    const t = await tenantsKv.actualizar(params.id, parsed.data);
    return NextResponse.json({ ok: true, tenant: t });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// DELETE: desactivar tenant (soft)
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
