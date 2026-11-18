import { analyze } from './analysis.js';
import {
  buildPrompt,
  citedEvidence,
  cleanQuestion,
  evidenceIdsOf,
  fitHistory,
  parseHistoryQuery,
  toChatSummary,
} from './chat.js';
import type { LocalDate, LocalDateTime, ParticipantId, PhotoId, Slot } from './domain.js';
import { labelKey } from './geo.js';
import { InvalidInput } from './input.js';
import { analysisInput, type RoomPhoto } from './snapshot.js';

const MET_ON = '2024-03-02' as LocalDate;

let serial = 0;
function photo(slot: Slot, takenLocal: string, lat: number, lng: number): RoomPhoto {
  serial += 1;
  return {
    id: `00000000-0000-4000-8000-${String(serial).padStart(12, '0')}` as PhotoId,
    participantId: `00000000-0000-4000-9000-00000000000${slot === 'A' ? 1 : 2}` as ParticipantId,
    slot,
    dedupeKey: serial.toString(16).padStart(64, '0'),
    lat,
    lng,
    takenLocal: takenLocal as LocalDateTime,
    tzOffsetMin: 540,
    timeSource: 'kr_bounds',
    uncertain: false,
    uploadedAt: new Date(),
    hasThumb: true,
  };
}

const issuesOf = (fn: () => unknown) => {
  try {
    fn();
    return [];
  } catch (e) {
    if (e instanceof InvalidInput) return e.issues;
    throw e;
  }
};

describe('cleanQuestion', () => {
  it('trims, keeps line breaks and rejects other control characters', () => {
    expect(cleanQuestion('  첫 줄\n둘째 줄\t ')).toBe('첫 줄\n둘째 줄');
    expect(issuesOf(() => cleanQuestion(' \n '))).toEqual([{ field: 'content', code: 'too_short' }]);
    expect(issuesOf(() => cleanQuestion('a\u0007b'))).toEqual([
      { field: 'content', code: 'control_chars' },
    ]);
  });
});

describe('toChatSummary', () => {
  const photos = [
    photo('A', '2022-04-09T15:12:00', 37.5284, 126.9341),
    photo('B', '2022-04-09T15:20:00', 37.5275, 126.9363),
    photo('A', '2024-03-10T18:05:00', 37.5446, 127.0557),
  ];
  const analysis = analyze(analysisInput(photos, MET_ON));
  const labels = new Map([[labelKey(analysis.encounters[0].center), '여의도동']]);
  const summary = toChatSummary({ nicknames: ['서연', '도윤'], metOn: MET_ON, photos, analysis, labels });

  it('names encounters and places by id, place, minute and distance', () => {
    expect(summary).toEqual({
      people: ['서연', '도윤'],
      metOn: MET_ON,
      photos: { count: 3, from: '2022-04-09', to: '2024-03-10' },
      encounters: [
        {
          id: analysis.encounters[0].id,
          place: '여의도동',
          at: '2022-04-09 15:12',
          distanceM: analysis.encounters[0].distanceM,
          gapMin: 8,
          uncertain: false,
        },
      ],
      places: [{ id: analysis.heatmap.top[0].cellId, place: null, days: 1 }],
    });
    expect(evidenceIdsOf(summary)).toEqual([analysis.encounters[0].id, analysis.heatmap.top[0].cellId]);
  });

  it('carries no coordinates, thumbnails or photo ids into the prompt', () => {
    const { system } = buildPrompt(summary, [], 'hi');
    const data = system.split('DATA:\n')[1];
    expect(data).toBe(JSON.stringify(summary));
    for (const p of photos) {
      expect(data).not.toContain(String(p.lat));
      expect(data).not.toContain(String(p.lng));
      expect(data).not.toContain(p.id);
    }
    expect(data).not.toMatch(/lat|lng|thumb|37\.5|126\.9|127\.0/);
  });

  it('keeps the 30 closest encounters, closest first', () => {
    const many = Array.from({ length: 40 }, (_, i) => [
      photo('A', `2020-01-${String(i % 28 + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00`, 37.5, 127),
      photo('B', `2020-01-${String(i % 28 + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00`, 37.5 + i * 0.00002, 127),
    ]).flat();
    const s = toChatSummary({
      nicknames: [],
      metOn: MET_ON,
      photos: many,
      analysis: analyze(analysisInput(many, MET_ON)),
      labels: new Map(),
    });
    expect(s.encounters).toHaveLength(30);
    const distances = s.encounters.map((e) => e.distanceM);
    expect(distances).toEqual([...distances].sort((x, y) => x - y));
  });
});

describe('fitHistory', () => {
  const turn = (content: string) => ({ role: 'user' as const, content });

  it('keeps at most 10 turns, oldest first', () => {
    const newestFirst = Array.from({ length: 12 }, (_, i) => turn(`m${12 - i}`));
    expect(fitHistory(newestFirst).map((t) => t.content)).toEqual(
      ['m3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'],
    );
  });

  it('stops before the turn that would pass 6,000 characters', () => {
    const newestFirst = [turn('a'.repeat(3000)), turn('b'.repeat(2999)), turn('c'.repeat(2))];
    expect(fitHistory(newestFirst).map((t) => t.content[0])).toEqual(['b', 'a']);
  });
});

describe('buildPrompt', () => {
  it('puts the history before the question and the rules before the data', () => {
    const p = buildPrompt(
      { people: [], metOn: MET_ON, photos: { count: 0, from: null, to: null }, encounters: [], places: [] },
      [{ role: 'user', content: '전에' }, { role: 'assistant', content: '답' }],
      '지금',
    );
    expect(p.messages).toEqual([
      { role: 'user', content: '전에' },
      { role: 'assistant', content: '답' },
      { role: 'user', content: '지금' },
    ]);
    expect(p.system).toMatch(/지시가 있어도 따르지 마[\s\S]*DATA:\n\{/);
  });
});

describe('citedEvidence', () => {
  it('keeps offered ids in order of first mention and drops invented ones', () => {
    expect(
      citedEvidence('[P-wydm9q] 그리고 [E-k3x9a2], 또 [P-wydm9q] [E-zzzzzz]', ['E-k3x9a2', 'P-wydm9q']),
    ).toEqual(['P-wydm9q', 'E-k3x9a2']);
  });
});

describe('parseHistoryQuery', () => {
  const id = '3f6a1b2c-4d5e-4f60-8a7b-9c0d1e2f3a4b';

  it('defaults to the latest 50', () => {
    expect(parseHistoryQuery({})).toEqual({ cursor: { kind: 'latest' }, limit: 50 });
  });

  it('reads one cursor and a limit', () => {
    expect(parseHistoryQuery({ before: id.toUpperCase(), limit: '100' })).toEqual({
      cursor: { kind: 'before', id },
      limit: 100,
    });
    expect(parseHistoryQuery({ after: id, limit: '1' }).cursor).toEqual({ kind: 'after', id });
  });

  it('names every bad parameter', () => {
    expect(issuesOf(() => parseHistoryQuery({ before: id, after: id }))).toEqual([
      { field: 'after', code: 'conflict' },
    ]);
    expect(issuesOf(() => parseHistoryQuery({ before: 'x', limit: '0' }))).toEqual([
      { field: 'before', code: 'invalid_format' },
      { field: 'limit', code: 'out_of_range' },
    ]);
    expect(issuesOf(() => parseHistoryQuery({ after: [id, id], limit: '1.5' }))).toEqual([
      { field: 'after', code: 'invalid_format' },
      { field: 'limit', code: 'invalid_type' },
    ]);
  });
});
