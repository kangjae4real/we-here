import { ApiError } from './problem.js';
import { RateLimiter } from './rate-limit.js';

const HOUR = 3_600_000;

function retryAfter(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (e) {
    if (!(e instanceof ApiError) || e.code !== 'rate_limited') throw e;
    return e.options.headers?.['Retry-After'];
  }
}

describe('RateLimiter', () => {
  it('allows `limit` hits per hour and names the wait in seconds', () => {
    const limiter = new RateLimiter();
    const t0 = 1_000_000;
    limiter.take('create', '1.1.1.1', 2, t0);
    limiter.take('create', '1.1.1.1', 2, t0 + 10_000);
    expect(
      retryAfter(() => limiter.take('create', '1.1.1.1', 2, t0 + 20_000)),
    ).toBe(String((HOUR - 20_000) / 1000));
  });

  it('slides: the oldest hit expiring frees one slot', () => {
    const limiter = new RateLimiter();
    limiter.take('create', 'ip', 1, 0);
    expect(retryAfter(() => limiter.take('create', 'ip', 1, HOUR - 1))).toBe(
      '1',
    );
    expect(
      retryAfter(() => limiter.take('create', 'ip', 1, HOUR)),
    ).toBeUndefined();
  });

  it('keeps buckets and IPs apart', () => {
    const limiter = new RateLimiter();
    limiter.take('create', 'ip', 1, 0);
    expect(retryAfter(() => limiter.take('join', 'ip', 1, 0))).toBeUndefined();
    expect(
      retryAfter(() => limiter.take('create', 'other', 1, 0)),
    ).toBeUndefined();
  });
});
