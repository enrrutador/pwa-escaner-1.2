import { NextResponse } from 'next/server';
import { usersKv } from '@/lib/server/users-kv';
import { leerCookieSesion } from '@/lib/server/session';
import { cambiarPasswordSchema, editarUsuarioSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPER_ADMIN = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'atenciafab@gmail.com';

async function authSuperAdmin(req: Request) {
  const payload = await leerCookieSesion(req.headers.get('cookie'));
  if (!payload) return false;
  return payload.correo === SUPER_ADMIN;
}

// PUT: cambiar password
export async function PUT(req: Request, { params }: { params: { correo: string } }) {
  try {
    if (!(await authSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const correo = decodeURIComponent(params.correo).toLowerCase();
    const body = await req.json();
    const parsed = cambiarPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 },
      );
    }
    await usersKv.actualizarPassword(correo, parsed.data.password);
    await usersKv.limpiarDispositivo(correo);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// PATCH: editar usuario (nombre, rol, tenantId, activo, telefono, notas)
export async function PATCH(req: Request, { params }: { params: { correo: string } }) {
  try {
    if (!(await authSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const correo = decodeURIComponent(params.correo).toLowerCase();
    const body = await req.json();
    const parsed = editarUsuarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 },
      );
    }
    if (correo === SUPER_ADMIN) {
      return NextResponse.json({ ok: false, error: 'No podés editar tu propia cuenta de super-admin' }, { status: 400 });
    }
    const data: any = { ...parsed.data };
    if (data.tenantId === null) data.tenantId = undefined;
    const u = await usersKv.actualizar(correo, data);
    return NextResponse.json({
      ok: true,
      usuario: {
        id: u.id, correo: u.correo, nombre: u.nombre, rol: u.rol, activo: u.activo,
        tenantId: u.tenantId, telefono: u.telefono, notas: u.notas,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// DELETE: desvincular dispositivo (sigue igual)
export async function DELETE(req: Request, { params }: { params: { correo: string } }) {
  try {
    if (!(await authSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    const correo = decodeURIComponent(params.correo).toLowerCase();
    await usersKv.limpiarDispositivo(correo);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
