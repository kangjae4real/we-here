import { parse } from 'yaml';
import { type Api, startApi } from './harness.js';

describe('API docs', () => {
  let api: Api;
  beforeAll(async () => {
    api = await startApi();
  });
  afterAll(() => api.close());

  it('serves Swagger UI', async () => {
    const res = await api.raw('GET', '/docs');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/html/);
    expect(res.body).toContain('swagger-ui');
  });

  it('serves the code-built document as JSON and YAML', async () => {
    const json = await api.raw('GET', '/docs/openapi.json');
    expect(json.status).toBe(200);
    expect(json.body.openapi).toBe('3.1.0');
    const yaml = await api.raw('GET', '/docs/openapi.yaml');
    expect(yaml.status).toBe(200);
    expect(parse(yaml.body)).toEqual(json.body);
  });

  it('answers 404 problem+json when API_DOCS=off', async () => {
    const off = await startApi({ env: { API_DOCS: 'off' } });
    try {
      for (const path of ['/docs', '/docs/openapi.json']) {
        const res = await off.raw('GET', path);
        expect(res.status).toBe(404);
        expect(res.headers.get('content-type')).toMatch(
          /^application\/problem\+json/,
        );
        expect(res.body.code).toBe('validation_failed');
      }
    } finally {
      await off.close();
    }
  });
});
