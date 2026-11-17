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
});
