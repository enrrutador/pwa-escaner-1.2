#!/usr/bin/env node
import { Redis } from '@upstash/redis';

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  console.error('ERROR: Set KV_REST_API_URL and KV_REST_API_TOKEN');
  console.error('  source <(grep = .env.local | sed "s/=/=/" )');
  process.exit(1);
}

const correo = process.env.ADMIN_EMAIL || 'atenciafab@gmail.com';
const password = process.env.ADMIN_PASSWORD;

if (!password) {
  console.error('ERROR: Set ADMIN_PASSWORD');
  process.exit(1);
}

const bcrypt = (await import('bcryptjs')).default;
const redis = new Redis({ url, token });
const key = `user:${correo.toLowerCase()}`;
const INDEX_KEY = 'index:users';

const exists = await redis.get(key);
if (exists) {
  console.log(`Admin ${correo} ya existe.`);
  process.exit(0);
}

const salt = await bcrypt.genSalt(12);
const passwordHash = await bcrypt.hash(password, salt);

const user = {
  id: crypto.randomUUID(),
  correo: correo.toLowerCase(),
  nombre: process.env.ADMIN_NAME || 'Marcelo',
  passwordHash,
  rol: 'admin',
  activo: true,
  createdAt: Date.now(),
};

await redis.set(key, user);
await redis.sadd(INDEX_KEY, correo.toLowerCase());
console.log(`Admin ${correo} creado.`);
