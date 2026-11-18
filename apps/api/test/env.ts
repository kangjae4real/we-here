export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://postgres:postgres@127.0.0.1:5432/wehere_test';

export const THUMB_SECRET = 'test-thumb-secret-0123456789abcdef';

export const TEST_ENV: Record<string, string> = {
  DATABASE_URL: TEST_DATABASE_URL,
  THUMB_SIGNING_SECRET: THUMB_SECRET,
  ROOM_CREATE_LIMIT_PER_HOUR: '100000',
  INVITE_PREVIEW_LIMIT_PER_HOUR: '100000',
  GEOCODER: 'fake',
  LLM_PROVIDER: 'fake',
};
