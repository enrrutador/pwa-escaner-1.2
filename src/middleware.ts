// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { leerCookieSesion } from '@/lib/server/session';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

// Rutas publicas (no requieren sesion)
const PUBLICAS = ['/login'];
const API_PUBLICAS = ['/api/auth/login', '/api/auth/logout'];

const SUPER_ADMIN = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'atenciafab@gmail.com';

const ALLOWED_ORIGINS = [
  'https://stockmaster-eta.vercel.app',
  'http://localhost:3000',
];

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
  }
  return {};
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
    return res;
  }

  // API de auth son publicas
  if (API_PUBLICAS.some((p) => pathname.startsWith(p))) {
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
    return res;
  }

  // Admin APIs: solo super-admin
  if (pathname.startsWith('/api/admin/')) {
    const payload = await leerCookieSesion(req.headers.get('cookie'));
    if (!payload || payload.correo !== SUPER_ADMIN) {
      const res = NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
      return res;
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
    return res;
  }

  // Otras API requieren cookie valida
  if (pathname.startsWith('/api/')) {
    const payload = await leerCookieSesion(req.headers.get('cookie'));
    if (!payload) {
      const res = NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
      for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
      return res;
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
    return res;
  }

  // Rutas publicas de pages
  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Archivos estaticos
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next();
  }

  // Admin page: solo super-admin
  if (pathname.startsWith('/admin')) {
    const payload = await leerCookieSesion(req.headers.get('cookie'));
    if (!payload || payload.correo !== SUPER_ADMIN) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Resto: requiere cookie
  const payload = await leerCookieSesion(req.headers.get('cookie'));
  if (!payload) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
