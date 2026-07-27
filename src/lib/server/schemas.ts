// src/lib/server/schemas.ts
import { z } from 'zod';

const correoSchema = z.string().trim().toLowerCase().email('Correo inválido').max(200);
const passwordSchema = z.string().min(8, 'Mínimo 8 caracteres').max(200);
const nombreSchema = z.string().trim().min(2, 'Nombre muy corto').max(80);

export const loginSchema = z.object({
  correo: correoSchema,
  password: passwordSchema,
  deviceId: z.string().min(8, 'deviceId invalido').max(200),
});

export const crearUsuarioSchema = z.object({
  correo: correoSchema,
  nombre: nombreSchema,
  password: passwordSchema,
  rol: z.enum(['admin', 'operador', 'viewer']),
  tenantId: z.string().optional(),
});

export const crearTenantSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre muy corto').max(120),
  correoContacto: correoSchema,
});

export const cambiarPasswordSchema = z.object({
  password: passwordSchema,
});
