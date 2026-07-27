#!/usr/bin/env node
import bcrypt from 'bcryptjs';

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
const correo = process.argv[2];
const newPassword = process.argv[3];

if (!url || !token || !correo || !newPassword) {
  console.error('Uso: KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/update-password.mjs <correo> <nueva-password>');
  process.exit(1);
}

const hash = await bcrypt.hash(newPassword, 12);
const res = await fetch(url + '/get/user:' + correo.toLowerCase(), {
  headers: { Authorization: 'Bearer ' + token },
});
const data = await res.json();
const user = JSON.parse(data.result);
user.passwordHash = hash;
for (const k of ['deviceId','sessionToken','sessionExpiresAt','lastLoginAt']) delete user[k];

const res2 = await fetch(url + '/set/user:' + correo.toLowerCase(), {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify(user),
});
const r = await res2.json();
console.log('Password updated:', r.result);
