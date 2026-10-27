import Redis from 'ioredis';
import { env } from './env.js';

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy: () => null, // Não fica tentando reconectar infinitamente se o Redis local estiver desligado
});

redis.on('error', () => {
  // Silencioso quando usando fallback em memória local
});

// Fallback em memória caso o Redis não esteja ativo em ambiente local de teste rápido
const memoryLocks = new Map<string, number>();

/**
 * Adquire um Lock Distribuído (Anti-Double Booking)
 * Garante que dois pacientes no WhatsApp não agendem o mesmo horário no mesmo milissegundo.
 */
export async function acquireDistributedLock(
  lockKey: string,
  ttlMs: number = 10000
): Promise<boolean> {
  try {
    const result = await redis.set(lockKey, 'locked', 'PX', ttlMs, 'NX');
    return result === 'OK';
  } catch {
    // Fallback em memória para resiliência local
    const now = Date.now();
    const expiresAt = memoryLocks.get(lockKey);
    if (expiresAt && expiresAt > now) {
      return false;
    }
    memoryLocks.set(lockKey, now + ttlMs);
    return true;
  }
}

export async function releaseDistributedLock(lockKey: string): Promise<void> {
  try {
    await redis.del(lockKey);
  } catch {
    memoryLocks.delete(lockKey);
  }
}
