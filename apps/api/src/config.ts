export interface Config {
  port: number;
  databaseUrl: string;
  /** Per IP per hour, for createRoom and, as its own bucket, joinRoom. */
  roomCreateLimitPerHour: number;
  invitePreviewLimitPerHour: number;
  photoLimitPerParticipant: number;
  chatRoomHourlyLimit: number;
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
  const int = (name: string, fallback: number, min: number): number => {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min) {
      problems.push(`${name} must be an integer >= ${min}`);
    }
    return value;
  };

  const config: Config = {
    port: int('PORT', 4000, 0),
    databaseUrl: required('DATABASE_URL'),
    roomCreateLimitPerHour: int('ROOM_CREATE_LIMIT_PER_HOUR', 10, 1),
    invitePreviewLimitPerHour: int('INVITE_PREVIEW_LIMIT_PER_HOUR', 60, 1),
    photoLimitPerParticipant: int('PHOTO_LIMIT_PER_PARTICIPANT', 2000, 1),
    chatRoomHourlyLimit: int('CHAT_ROOM_HOURLY_LIMIT', 30, 1),
  };
  return problems.length ? { ok: false, problems } : { ok: true, config };
}
