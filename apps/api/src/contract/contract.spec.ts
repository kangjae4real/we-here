import { NestFactory } from '@nestjs/core';
import { generate, OUTPUTS } from '../../scripts/gen-contract.js';
import { AppModule } from '../app.module.js';
import { readConfig } from '../config.js';
import { InvalidInput } from '../core/input.js';
import { buildOpenApiDocument } from './document.js';
import { parseJsonBody } from './index.js';

describe('emitted contract', () => {
  it('matches the document the code builds (run `pnpm --filter api contract:emit` if this fails)', async () => {
    const parsed = readConfig({
      DATABASE_URL: 'postgres://unused',
      THUMB_SIGNING_SECRET: 'x'.repeat(32),
    });
    if (!parsed.ok) throw new Error(parsed.problems.join('; '));
    const app = await NestFactory.create(AppModule.forRoot(parsed.config), {
      preview: true,
      logger: false,
    });
    const out = await generate(buildOpenApiDocument(app));
    await app.close();
    await expect(out.types).toMatchFileSnapshot(OUTPUTS.types);
    await expect(out.openapi).toMatchFileSnapshot(OUTPUTS.openapi);
  });
});

describe('parseJsonBody', () => {
  const issuesOf = (body: unknown) => {
    try {
      parseJsonBody('createRoom', body);
      return [];
    } catch (e) {
      if (e instanceof InvalidInput) return e.issues;
      throw e;
    }
  };

  it('accepts a body the contract allows', () => {
    expect(
      issuesOf({ name: '우리', nickname: '서연', metOn: '2024-03-02' }),
    ).toEqual([]);
  });

  it('names each failing field with a stable code', () => {
    expect(issuesOf({ name: '', metOn: '2023-02-29', extra: 1 })).toEqual(
      expect.arrayContaining([
        { field: 'nickname', code: 'required' },
        { field: 'extra', code: 'unknown_field' },
        { field: 'name', code: 'too_short' },
        { field: 'metOn', code: 'invalid_format' },
      ]),
    );
  });

  it('reports a non-object body as the body field', () => {
    expect(issuesOf('nope')).toEqual([{ field: 'body', code: 'invalid_type' }]);
  });
});
