export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://postgres:postgres@127.0.0.1:5432/wehere_test';

export const TEST_ENV: Record<string, string> = {
  DATABASE_URL: TEST_DATABASE_URL,
};
