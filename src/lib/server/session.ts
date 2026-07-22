// src/lib/server/session.ts
// Cookies httpOnly firmadas con HMAC SHA-256 (WebCrypto, compatible Edge).

const SECRET = process.env.SESSION_SECRET || process.env.KV_REST_API_TOKEN || 'dev-insecure-fallback';

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64url(sig);
}

async function timingSafeEqualBuf(a: Uint8Array, b: Uint8Array): Promise<boolean> {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface SessionPayload {
  correo: string;
  deviceId: string;
  rol: string;
  exp: number;
}

export async function crearCookieSesion(p: SessionPayload): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify(p)));
  const mac = await hmac(payload);
  const valor = `${payload}.${mac}`;
  const maxAge = Math.max(0, Math.floor((p.exp - Date.now()) / 1000));
  return `sm_session=${valor}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function vaciarCookieSesion(): string {
  return `sm_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function leerCookieSesion(cookieHeader: string | null): Promise<SessionPayload | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/sm_session=([^;]+)/);
  if (!match) return null;
  const valor = match[1];
  const partes = valor.split('.');
  if (partes.length !== 2) return null;
  const [payload, mac] = partes;

  const expected = await hmac(payload);
  const ok = await timingSafeEqualBuf(fromB64url(mac), fromB64url(expected));
  if (!ok) return null;

  try {
    const json = new TextDecoder().decode(fromB64url(payload));
    const data: SessionPayload = JSON.parse(json);
    if (data.exp && data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
