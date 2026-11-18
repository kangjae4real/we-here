import { Injectable } from '@nestjs/common';
import { ApiError } from './problem.js';

const HOUR_MS = 3_600_000;
const SWEEP_AT = 10_000;

@Injectable()
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  take(bucket: string, ip: string, limit: number, nowMs = Date.now()): void {
    const key = `${bucket} ${ip}`;
    const since = nowMs - HOUR_MS;
    const log = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (log.length >= limit) {
      this.hits.set(key, log);
      const retryAfter = Math.max(
        1,
        Math.ceil((log[0] + HOUR_MS - nowMs) / 1000),
      );
      throw new ApiError('rate_limited', {
        headers: { 'Retry-After': String(retryAfter) },
      });
    }
    log.push(nowMs);
    this.hits.set(key, log);
    if (this.hits.size > SWEEP_AT) this.sweep(since);
  }

  private sweep(since: number): void {
    for (const [key, log] of this.hits) {
      if (log[log.length - 1] <= since) this.hits.delete(key);
    }
  }
}
