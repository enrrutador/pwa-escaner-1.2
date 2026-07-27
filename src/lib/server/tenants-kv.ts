import { Redis } from '@upstash/redis';

export interface TenantKv {
  id: string;
  nombre: string;
  correoContacto: string;
  telefono?: string;
  cuit?: string;
  plan: 'gratuito' | 'basico' | 'pro' | 'empresarial';
  activo: boolean;
  createdAt: number;
  vencimiento?: number; // timestamp de vencimiento de suscripción
  notas?: string;
}

function kv(): Redis {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('KV_REST_API_URL/TOKEN no configuradas');
  return new Redis({ url, token });
}

const key = (id: string) => `tenant:${id}`;
const INDEX_KEY = 'index:tenants';

export const tenantsKv = {
  async listar(): Promise<TenantKv[]> {
    const r = kv();
    const ids = (await r.smembers(INDEX_KEY)) as string[];
    if (!ids.length) return [];
    const tenants = (await r.mget(...ids.map(key))) as unknown as TenantKv[];
    return tenants.filter(Boolean);
  },

  async obtener(id: string): Promise<TenantKv | null> {
    const r = kv();
    return r.get<TenantKv>(key(id));
  },

  async crear(data: {
    nombre: string;
    correoContacto: string;
    telefono?: string;
    cuit?: string;
    plan?: TenantKv['plan'];
    vencimiento?: number;
    notas?: string;
  }): Promise<TenantKv> {
    const r = kv();
    const id = 'tnt_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const tenant: TenantKv = {
      id,
      nombre: data.nombre,
      correoContacto: data.correoContacto.toLowerCase(),
      telefono: data.telefono,
      cuit: data.cuit,
      plan: data.plan || 'gratuito',
      activo: true,
      createdAt: Date.now(),
      vencimiento: data.vencimiento,
      notas: data.notas,
    };
    await r.set(key(id), tenant);
    await r.sadd(INDEX_KEY, id);
    return tenant;
  },

  async actualizar(id: string, campos: Partial<Omit<TenantKv, 'id' | 'createdAt'>>): Promise<TenantKv> {
    const r = kv();
    const t = await r.get<TenantKv>(key(id));
    if (!t) throw new Error('Tenant no encontrado');
    Object.assign(t, campos);
    await r.set(key(id), t);
    return t;
  },

  async desactivar(id: string): Promise<void> {
    const r = kv();
    const t = await r.get<TenantKv>(key(id));
    if (!t) throw new Error('Tenant no encontrado');
    t.activo = false;
    await r.set(key(id), t);
  },

  async eliminar(id: string): Promise<void> {
    const r = kv();
    await r.del(key(id));
    await r.srem(INDEX_KEY, id);
  },
};

