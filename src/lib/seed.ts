// src/lib/seed.ts
// Seed inicial: solo crea admin Marcelo (PIN 1234 + password Saturnoviamail1) si no existe.

import { dbUsuarios } from './db-usuarios';

export async function seedSiVacio(): Promise<void> {
  // Solo crear admin si no hay usuarios
  const hayUsuarios = await dbUsuarios.hayUsuarios();
  if (hayUsuarios) return;

  await dbUsuarios.crearAdmin({
    nombre: 'Marcelo',
    pin: '1234',
    password: 'Saturnoviamail1',
  });
}
