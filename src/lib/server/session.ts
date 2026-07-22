// src/lib/server/session.ts
// Cookies httpOnly firmadas con HMAC SHA-256.
// Formato: base64url(payload).base64url(hmac(payload))
// Payload incluye correo, deviceId, rol, exp.

import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.SESSION_SECRET || process.env.KV_REST_API_TOKEN || 'dev-insecure-fallback';

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

function sign(payload: string): string {
  return b64url(createHmac('sha256', SECRET).update(payload).digest());
}

export interface SessionPayload {
  correo: string;
  deviceId: string;
  rol: string;
  exp: number; // timestamp ms
}

export function crearCookieSesion(p: SessionPayload): string {
  const payload = b64url(JSON.stringify(p));
  const mac = sign(payload);
  const valor = `${payload}.${mac}`;
  const maxAge = Math.max(0, Math.floor((p.exp - Date.now()) / 1000));
  return `sm_session=${valor}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function vaciarCookieSesion(): string {
  return `sm_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function leerCookieSesion(cookieHeader: string | null): SessionPayload | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/sm_session=([^;]+)/);
  if (!match) return null;
  const valor = match[1];
  const partes = valor.split('.');
  if (partes.length !== 2) return null;
  const [payload, mac] = partes;

  // Validar firma
  const expected = sign(payload);
  try {
    const a = fromB64url(mac);
    const b = fromB64url(expected);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const data: SessionPayload = JSON.parse(fromB64url(payload).toString('utf8'));
    if (data.exp && data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
