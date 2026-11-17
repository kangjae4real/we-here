import { readFile } from 'node:fs/promises';
import {
  CONTRACT_PATH,
  generate,
  OUTPUTS,
} from '../../scripts/gen-contract.js';
import { InvalidInput } from '../core/input.js';
import { parseJsonBody } from './index.js';

describe('generated contract', () => {
  it('matches docs/api/openapi.yaml (run `pnpm --filter api contract:gen` if this fails)', async () => {
    const fresh = await generate(await readFile(CONTRACT_PATH, 'utf8'));
    expect(await readFile(OUTPUTS.types, 'utf8')).toBe(fresh.types);
    expect(await readFile(OUTPUTS.openapi, 'utf8')).toBe(fresh.openapi);
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

  it('accepts a body the YAML allows', () => {
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
