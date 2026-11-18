import { type Api, startApi } from './harness.js';

describe('health and global HTTP behavior', () => {
  let api: Api;
  beforeAll(async () => {
    api = await startApi();
  });
  afterAll(() => api.close());

  it('reports ok after a real DB query', async () => {
    const res = await api.call('getHealth');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', checks: { db: 'ok' } });
  });

  it('gives every response its own request id', async () => {
    const [a, b] = await Promise.all([
      api.call('getHealth'),
      api.call('getHealth'),
    ]);
    expect(a.headers.get('x-request-id')).not.toBe(
      b.headers.get('x-request-id'),
    );
  });

  it('answers unknown routes with a problem', async () => {
    const res = await api.raw('GET', '/nope');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('validation_failed');
  });

  it('reports 503 with checks.db=fail when the database is unreachable', async () => {
    const down = await startApi({
      env: { DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:1/none' },
    });
    try {
      const res = await down.call('getHealth');
      expect(res.status).toBe(503);
      expect(res.body.checks).toEqual({ db: 'fail' });
    } finally {
      await down.close();
    }
  });
});
