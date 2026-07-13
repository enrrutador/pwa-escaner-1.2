// src/lib/seed.ts
// Seed inicial: solo crea usuario admin Marcelo/1234 si no existe.

import { dbUsuarios } from './db-usuarios';

export async function seedSiVacio(): Promise<void> {
  // Solo crear admin si no hay usuarios
  const hayUsuarios = await dbUsuarios.hayUsuarios();
  if (hayUsuarios) return;

  await dbUsuarios.crear({ nombre: 'Marcelo', pin: '1234', rol: 'admin' });
}