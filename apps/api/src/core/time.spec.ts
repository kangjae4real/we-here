import { correctTime, type ExifClock, nextKstMidnightMs } from './time.js';

const NOW = Date.parse('2026-11-17T00:00:00Z');
const PARIS = { lat: 48.8566, lng: 2.3522 };
const SEOUL = { lat: 37.5665, lng: 126.978 };

const correct = (m: Partial<ExifClock>) =>
  correctTime({ dateTimeOriginal: '2022:04:09 15:12:03', ...PARIS, ...m }, NOW);

describe('correctTime: zone source (E11)', () => {
  it('trusts OffsetTimeOriginal first, even inside Korea', () => {
    expect(correct({ ...SEOUL, offsetTimeOriginal: '-03:30' })).toEqual({
      ok: true,
      time: {
        takenLocal: '2022-04-09T15:12:03',
        tzOffsetMin: -210,
        timeSource: 'offset',
        uncertain: false,
      },
    });
  });

  it('accepts offsets from -12:00 to +14:00 and nothing beyond', () => {
    expect(correct({ offsetTimeOriginal: '-12:00' }).ok).toBe(true);
    expect(correct({ offsetTimeOriginal: '+14:00' }).ok).toBe(true);
    for (const offsetTimeOriginal of ['-12:15', '+14:15', '+09:60']) {
      expect(correct({ offsetTimeOriginal })).toEqual({
        ok: false,
        field: 'offsetTimeOriginal',
      });
    }
  });

  it('puts photos inside the Korea box on KST with certainty', () => {
    const inside = correct({
      lat: 33,
      lng: 124,
      gpsDateStamp: '2022:04:09',
      gpsTimeStamp: '13:12:03',
    });
    expect(inside).toMatchObject({
      time: { tzOffsetMin: 540, timeSource: 'kr_bounds', uncertain: false },
    });
    const outside = correct({ lat: 32.9999, lng: 124 });
    expect(outside).toMatchObject({ time: { timeSource: 'assumed_kst' } });
  });

  it('derives the zone from the GPS clock, rounded to 15 minutes', () => {
    expect(
      correct({ gpsDateStamp: '2022:04:09', gpsTimeStamp: '13:12:03' }),
    ).toMatchObject({
      time: { tzOffsetMin: 120, timeSource: 'gps', uncertain: false },
    });
  });

  it('marks a GPS gap more than 5 minutes off the quarter hour uncertain', () => {
    const at = (gpsTimeStamp: string) =>
      correct({ gpsDateStamp: '2022:04:09', gpsTimeStamp });
    expect(at('13:07:03')).toMatchObject({
      time: { tzOffsetMin: 120, uncertain: false },
    });
    expect(at('13:06:03')).toMatchObject({
      time: { tzOffsetMin: 120, uncertain: true },
    });
    expect(at('13:12:03.25')).toMatchObject({ time: { timeSource: 'gps' } });
  });

  it('moves a GPS stamp from the wrong day back into range', () => {
    const la = correct({
      dateTimeOriginal: '2022:04:09 08:00:00',
      gpsDateStamp: '2022:04:08',
      gpsTimeStamp: '15:00:00',
    });
    expect(la).toMatchObject({
      time: { tzOffsetMin: -420, timeSource: 'gps' },
    });
  });

  it('skips unparseable GPS fields and assumes KST, uncertain', () => {
    expect(
      correct({ gpsDateStamp: 'garbage', gpsTimeStamp: '13:12:03' }),
    ).toEqual({
      ok: true,
      time: {
        takenLocal: '2022-04-09T15:12:03',
        tzOffsetMin: 540,
        timeSource: 'assumed_kst',
        uncertain: true,
      },
    });
  });
});

describe('correctTime: the local time itself (E12)', () => {
  const at = (dateTimeOriginal: string) => correct({ dateTimeOriginal }).ok;

  it('checks the real calendar', () => {
    expect(at('2024:02:29 12:00:00')).toBe(true);
    expect(at('2023:02:29 12:00:00')).toBe(false);
    expect(at('2022:04:31 12:00:00')).toBe(false);
    expect(at('2022:04:09 24:00:00')).toBe(false);
    expect(at('2022:04:09 23:59:60')).toBe(false);
  });

  it('accepts 1990 through next year (UTC) only', () => {
    expect(at('1989:12:31 23:59:59')).toBe(false);
    expect(at('1990:01:01 00:00:00')).toBe(true);
    expect(at('2027:12:31 23:59:59')).toBe(true);
    expect(at('2028:01:01 00:00:00')).toBe(false);
  });

  it('names dateTimeOriginal as the failing field', () => {
    expect(correct({ dateTimeOriginal: '2022-04-09 15:12:03' })).toEqual({
      ok: false,
      field: 'dateTimeOriginal',
    });
  });
});

describe('nextKstMidnightMs', () => {
  it('is 15:00 UTC on the day the KST date turns', () => {
    const at = (iso: string) => new Date(nextKstMidnightMs(Date.parse(iso))).toISOString();
    expect(at('2024-03-02T14:59:59Z')).toBe('2024-03-02T15:00:00.000Z');
    expect(at('2024-03-02T15:00:00Z')).toBe('2024-03-03T15:00:00.000Z');
  });
});
