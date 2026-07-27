import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;
const PASSWORD_SALT = 'stockmaster::v1::pwd-salt';
const BCRYPT_PREFIXES = ['$2a$', '$2b$', '$2y$'];

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function hashSha256(password: string): Promise<string> {
  const data = `${PASSWORD_SALT}:${password}`;
  const buf = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verificarPassword(password: string, storedHash: string): Promise<boolean> {
  const esBcrypt = BCRYPT_PREFIXES.some((p) => storedHash.startsWith(p));
  if (esBcrypt) {
    return bcrypt.compare(password, storedHash);
  }
  const hash = await hashSha256(password);
  return hash === storedHash;
}

export function necesitaRehash(storedHash: string): boolean {
  return !BCRYPT_PREFIXES.some((p) => storedHash.startsWith(p));
}
