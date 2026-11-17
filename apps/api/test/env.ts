export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://postgres:postgres@127.0.0.1:5432/wehere_test';

/** Every spec shares 127.0.0.1, so per-IP limits are lifted unless a spec lowers them. */
export const TEST_ENV: Record<string, string> = {
  DATABASE_URL: TEST_DATABASE_URL,
  ROOM_CREATE_LIMIT_PER_HOUR: '100000',
  INVITE_PREVIEW_LIMIT_PER_HOUR: '100000',
};
