export interface Config {
  port: number;
  databaseUrl: string;
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
  };
  return problems.length ? { ok: false, problems } : { ok: true, config };
}
