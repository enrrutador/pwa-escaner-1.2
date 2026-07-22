// src/lib/server/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

function kv(): Redis {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('KV_REST_API_URL/TOKEN no configuradas');
  }
  return new Redis({ url, token });
}

// Limite por IP: 5 intentos por minuto en login, 10 por minuto en admin
export const ratelimitLogin = new Ratelimit({
  redis: kv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'rl:login',
});
export const ratelimitAdmin = new Ratelimit({
  redis: kv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:admin',
});

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

export async function checkRatelimit(
  limiter: Ratelimit,
  id: string,
): Promise<{ ok: boolean; reset?: number }> {
  try {
    const res = await limiter.limit(id);
    return { ok: res.success, reset: res.reset };
  } catch {
    // Si Upstash falla, permitimos (fail-open para no bloquear el login legitimo)
    return { ok: true };
  }
}
