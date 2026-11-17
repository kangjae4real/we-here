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
});
