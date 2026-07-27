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
  telefono: z.string().max(40).optional(),
  notas: z.string().max(500).optional(),
});

export const cambiarPasswordSchema = z.object({
  password: passwordSchema,
});

export const crearTenantSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre muy corto').max(120),
  correoContacto: correoSchema,
  telefono: z.string().max(40).optional(),
  cuit: z.string().max(20).optional(),
  plan: z.enum(['gratuito', 'basico', 'pro', 'empresarial']).optional(),
  vencimiento: z.number().int().positive().optional(),
  notas: z.string().max(500).optional(),
});

export const editarTenantSchema = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  correoContacto: correoSchema.optional(),
  telefono: z.string().max(40).optional(),
  cuit: z.string().max(20).optional(),
  plan: z.enum(['gratuito', 'basico', 'pro', 'empresarial']).optional(),
  vencimiento: z.number().int().positive().optional(),
  activo: z.boolean().optional(),
  notas: z.string().max(500).optional(),
});

export const editarUsuarioSchema = z.object({
  nombre: nombreSchema.optional(),
  rol: z.enum(['admin', 'operador', 'viewer']).optional(),
  tenantId: z.string().optional().nullable(),
  activo: z.boolean().optional(),
  telefono: z.string().max(40).optional(),
  notas: z.string().max(500).optional(),
});
