import type { Redis } from 'ioredis';

export async function checkAndConsumeHourlyLimit(
  redis: Redis,
  sender: string,
  hourlyLimit: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const now = Date.now();
  const hourWindow = Math.floor(now / 3600000);
  const key = `rate:${sender}:${hourWindow}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 7200);
  }

  if (count > hourlyLimit) {
    await redis.decr(key);
    const nextHourStart = (hourWindow + 1) * 3600000;
    const retryAfterMs = Math.max(1000, nextHourStart - now + 500);
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true, retryAfterMs: 0 };
}

export async function acquireSendGapLock(
  redis: Redis,
  gapMs: number,
  jobId: string
): Promise<{ acquired: boolean; retryAfterMs: number }> {
  if (gapMs <= 0) {
    return { acquired: true, retryAfterMs: 0 };
  }

  const key = 'email-send-gap-lock';
  const result = await redis.set(key, jobId, 'PX', gapMs, 'NX');

  if (!result) {
    const ttl = await redis.pttl(key);
    const retryAfterMs = Math.max(250, ttl > 0 ? ttl : gapMs) + 50;
    return { acquired: false, retryAfterMs };
  }

  return { acquired: true, retryAfterMs: 0 };
}
