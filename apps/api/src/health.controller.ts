import { Controller, Get } from '@nestjs/common';
import type { W } from './contract/index.js';
import { Db } from './db/db.js';
import { ApiError } from './http/problem.js';

@Controller('health')
export class HealthController {
  constructor(private readonly db: Db) {}

  @Get()
  async getHealth(): Promise<W<'Health'>> {
    try {
      await this.db.q.one('SELECT 1');
    } catch {
      throw new ApiError('internal_error', {
        status: 503,
        detail: 'Database unreachable',
        members: { checks: { db: 'fail' } },
      });
    }
    return { status: 'ok', checks: { db: 'ok' } };
  }
}
