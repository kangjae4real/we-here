import {
  type Deadlines,
  FAKE_SCENARIOS,
  type FakeScenario,
  LLM_ADAPTERS,
  type LlmProviderName,
  type LlmSettings,
} from './chat/llm.js';
import {
  GEOCODERS,
  type GeocoderKeys,
  type GeocoderName,
} from './snapshot/geocoders.js';

/** A missing LLM leaves the rest of the API up; chat answers 503 `server_misconfigured` with the reason. */
export type LlmConfig =
  | { ok: true; provider: LlmProviderName; settings: LlmSettings }
  | { ok: false; reason: string };

export interface Config {
  port: number;
  databaseUrl: string;
  /** Per IP per hour, for createRoom and, as its own bucket, joinRoom. */
  roomCreateLimitPerHour: number;
  invitePreviewLimitPerHour: number;
  photoLimitPerParticipant: number;
  chatRoomHourlyLimit: number;
  /** Service-wide answers per KST day. */
  chatDailyLimit: number;
  /** HMAC key for /thumbs URLs; rotating it invalidates every issued URL. */
  thumbSigningSecret: string;
  geocoder: GeocoderName;
  geocoderKeys: GeocoderKeys;
  llm: LlmConfig;
  llmDeadlines: Deadlines;
}

export const CONFIG = Symbol('Config');

export type ConfigResult =
  { ok: true; config: Config } | { ok: false; problems: string[] };

/** Parsed once at boot; main.ts exits naming every bad variable. */
export function readConfig(
  env: Record<string, string | undefined>,
): ConfigResult {
  const problems: string[] = [];

  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) problems.push(`${name} is required`);
    return value ?? '';
  };
  const secret = (name: string, minLength: number): string => {
    const value = required(name);
    if (value && value.length < minLength) {
      problems.push(`${name} must be at least ${minLength} characters`);
    }
    return value;
  };
  const int = (name: string, fallback: number, min: number): number => {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min) {
      problems.push(`${name} must be an integer >= ${min}`);
    }
    return value;
  };

  const oneOf = <K extends string>(
    name: string,
    allowed: Record<K, unknown>,
    fallback: K,
  ): K => {
    const value = env[name]?.trim();
    if (!value) return fallback;
    if (!Object.hasOwn(allowed, value)) {
      problems.push(`${name} must be one of ${Object.keys(allowed).join(', ')}`);
    }
    return value as K;
  };

  const geocoder = oneOf<GeocoderName>('GEOCODER', GEOCODERS, 'none');
  const geocoderKeys: GeocoderKeys =
    geocoder === 'naver'
      ? {
          ncpClientId: required('NCP_CLIENT_ID'),
          ncpClientSecret: required('NCP_CLIENT_SECRET'),
        }
      : {};

  const optional = (name: string) => env[name]?.trim() ?? '';
  const llm = ((): LlmConfig => {
    if (!optional('LLM_PROVIDER')) {
      return { ok: false, reason: 'LLM_PROVIDER is not set' };
    }
    const provider = oneOf<LlmProviderName>('LLM_PROVIDER', LLM_ADAPTERS, 'fake');
    const settings: LlmSettings = {
      model: optional('LLM_MODEL'),
      apiKey: optional('LLM_API_KEY'),
      baseUrl: optional('LLM_BASE_URL') || 'https://api.openai.com/v1',
      fake: {
        scenario: oneOf<FakeScenario>('LLM_FAKE_SCENARIO', FAKE_SCENARIOS, 'ok'),
        delayMs: int('LLM_FAKE_DELAY_MS', 0, 0),
      },
    };
    if (provider !== 'fake') {
      const missing = ['LLM_MODEL', 'LLM_API_KEY'].filter((n) => !optional(n));
      if (missing.length) {
        return { ok: false, reason: `${missing.join(', ')} not set for ${provider}` };
      }
    }
    return { ok: true, provider, settings };
  })();

  const config: Config = {
    port: int('PORT', 4000, 0),
    databaseUrl: required('DATABASE_URL'),
    roomCreateLimitPerHour: int('ROOM_CREATE_LIMIT_PER_HOUR', 10, 1),
    invitePreviewLimitPerHour: int('INVITE_PREVIEW_LIMIT_PER_HOUR', 60, 1),
    photoLimitPerParticipant: int('PHOTO_LIMIT_PER_PARTICIPANT', 2000, 1),
    chatRoomHourlyLimit: int('CHAT_ROOM_HOURLY_LIMIT', 30, 1),
    chatDailyLimit: int('CHAT_DAILY_LIMIT', 500, 1),
    thumbSigningSecret: secret('THUMB_SIGNING_SECRET', 32),
    geocoder,
    geocoderKeys,
    llm,
    llmDeadlines: {
      firstMs: int('LLM_FIRST_TOKEN_TIMEOUT_MS', 30_000, 1),
      idleMs: int('LLM_IDLE_TIMEOUT_MS', 15_000, 1),
    },
  };
  return problems.length ? { ok: false, problems } : { ok: true, config };
}
