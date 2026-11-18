import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RESPONSES, schemaRef } from './contract/components.js';
import type { W } from './contract/index.js';
import { Db } from './db/db.js';
import { ApiError } from './http/problem.js';

@Controller('health')
export class HealthController {
  constructor(private readonly db: Db) {}

  @ApiOperation({
    tags: ['system'],
    operationId: 'getHealth',
    summary: '서버와 DB 연결 확인',
    description:
      '발표 전 API를 미리 깨울 때도 쓴다. DB 쿼리까지 성공해야 200이다.',
    security: [],
  })
  @ApiResponse({
    status: 200,
    description: '정상',
    content: { 'application/json': { schema: schemaRef('Health') } },
  })
  @ApiResponse({
    status: 503,
    description: 'DB 연결 실패',
    content: {
      'application/problem+json': {
        schema: {
          allOf: [
            schemaRef('Problem'),
            {
              type: 'object',
              properties: {
                checks: {
                  type: 'object',
                  properties: { db: { type: 'string', enum: ['ok', 'fail'] } },
                },
              },
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
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
