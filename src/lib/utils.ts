// src/lib/utils.ts
// Utilidades base: uid, now, hashPin (Web Crypto SHA-256 con salt).

const PIN_SALT = 'stockmaster::v1::salt';

/** UUID con fallback a timestamp + random para entornos sin crypto.randomUUID. */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Timestamp actual en milisegundos. */
export function now(): number {
  return Date.now();
}

/**
 * Hash de PIN con Web Crypto SHA-256(salt + pin).
 * Devuelve hex. Fallback simple si SubtleCrypto no está disponible.
 */
export async function hashPin(pin: string): Promise<string> {
  const data = `${PIN_SALT}:${pin}`;

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = new TextEncoder().encode(data);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback determinístico (no criptográfico) para entornos sin SubtleCrypto.
  let h = 0;
  for (let i = 0; i < data.length; i++) {
    h = (Math.imul(31, h) + data.charCodeAt(i)) | 0;
  }
  return `fallback_${(h >>> 0).toString(16)}`;
}

/** Normaliza texto para deduplicación (trim, lower, primeros 30 chars). */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase().slice(0, 30);
}

/** Formatea a moneda ARS/USD simple. */
export function formatMoney(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
