import { readConfig } from './config.js';

const VALID = {
  DATABASE_URL: 'postgres://localhost/wehere',
  THUMB_SIGNING_SECRET: 'x'.repeat(32),
};

describe('readConfig', () => {
  it('fills the documented defaults', () => {
    const r = readConfig(VALID);
    expect(r).toMatchObject({
      ok: true,
      config: {
        port: 4000,
        roomCreateLimitPerHour: 10,
        photoLimitPerParticipant: 2000,
        chatRoomHourlyLimit: 30,
      },
    });
  });

  it('names every missing or malformed variable at once', () => {
    const r = readConfig({
      THUMB_SIGNING_SECRET: 'short',
      PHOTO_LIMIT_PER_PARTICIPANT: 'many',
    });
    expect(r).toEqual({
      ok: false,
      problems: [
        'DATABASE_URL is required',
        'PHOTO_LIMIT_PER_PARTICIPANT must be an integer >= 1',
        'THUMB_SIGNING_SECRET must be at least 32 characters',
      ],
    });
  });

  it('geocodes nothing unless GEOCODER says otherwise', () => {
    expect(readConfig(VALID)).toMatchObject({ config: { geocoder: 'none' } });
  });

  it('rejects an unknown GEOCODER and Naver without its keys', () => {
    expect(readConfig({ ...VALID, GEOCODER: 'google' })).toEqual({
      ok: false,
      problems: ['GEOCODER must be one of none, fake, naver'],
    });
    expect(readConfig({ ...VALID, GEOCODER: 'naver' })).toEqual({
      ok: false,
      problems: ['NCP_CLIENT_ID is required', 'NCP_CLIENT_SECRET is required'],
    });
  });

  it('turns chat off, not the server, when the LLM is not set up', () => {
    expect(readConfig(VALID)).toMatchObject({
      config: { llm: { ok: false, reason: 'LLM_PROVIDER is not set' } },
    });
    expect(
      readConfig({ ...VALID, LLM_PROVIDER: 'openai-compatible', LLM_MODEL: 'm' }),
    ).toMatchObject({
      config: {
        llm: { ok: false, reason: 'LLM_API_KEY not set for openai-compatible' },
      },
    });
  });

  it('reads an OpenAI-compatible provider with its deadlines', () => {
    const r = readConfig({
      ...VALID,
      LLM_PROVIDER: 'openai-compatible',
      LLM_MODEL: 'meta/llama-3.3-70b-instruct',
      LLM_API_KEY: 'nvapi-x',
      LLM_BASE_URL: 'https://integrate.api.nvidia.com/v1',
    });
    expect(r).toMatchObject({
      config: {
        chatDailyLimit: 500,
        llmDeadlines: { firstMs: 30_000, idleMs: 15_000 },
        llm: {
          ok: true,
          provider: 'openai-compatible',
          settings: { baseUrl: 'https://integrate.api.nvidia.com/v1', apiKey: 'nvapi-x' },
        },
      },
    });
  });

  it('rejects an unknown LLM_PROVIDER or fake scenario', () => {
    expect(readConfig({ ...VALID, LLM_PROVIDER: 'gpt', LLM_FAKE_SCENARIO: 'chaos' })).toEqual({
      ok: false,
      problems: [
        'LLM_PROVIDER must be one of fake, openai-compatible',
        'LLM_FAKE_SCENARIO must be one of ok, length, mid_error, empty, rate_limited, error',
      ],
    });
  });
});
