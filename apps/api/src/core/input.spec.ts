import { vacantSlot } from './domain.js';
import { checkMetOn, cleanText, type FieldIssue } from './input.js';

describe('cleanText', () => {
  const run = (raw: string) => {
    const issues: FieldIssue[] = [];
    return { value: cleanText(raw, 'nickname', issues), issues };
  };

  it('trims and keeps inner spaces', () => {
    expect(run('  서 연 ')).toEqual({ value: '서 연', issues: [] });
  });

  it('treats whitespace-only as too short', () => {
    expect(run(' 　 ').issues).toEqual([
      { field: 'nickname', code: 'too_short' },
    ]);
  });

  it('rejects C0 and C1 control characters inside the text', () => {
    expect(run('a\u0000b').issues[0].code).toBe('control_chars');
    expect(run('a\u0085b').issues[0].code).toBe('control_chars');
  });
});

describe('checkMetOn', () => {
  // 2024-03-02T15:00Z is 2024-03-03 00:00 in KST.
  const kstMidnight = Date.parse('2024-03-02T15:00:00Z');
  const issuesFor = (raw: string, nowMs: number) => {
    const issues: FieldIssue[] = [];
    checkMetOn(raw, nowMs, issues);
    return issues.map((i) => i.code);
  };

  it('accepts 1990-01-01 and rejects the day before', () => {
    expect(issuesFor('1990-01-01', kstMidnight)).toEqual([]);
    expect(issuesFor('1989-12-31', kstMidnight)).toEqual(['out_of_range']);
  });

  it('uses the KST calendar for today', () => {
    expect(issuesFor('2024-03-03', kstMidnight)).toEqual([]);
    expect(issuesFor('2024-03-03', kstMidnight - 1)).toEqual(['out_of_range']);
  });
});

describe('vacantSlot', () => {
  it('fills A first, then B, then reports full', () => {
    expect(vacantSlot([])).toBe('A');
    expect(vacantSlot([{ slot: 'A' }])).toBe('B');
    expect(vacantSlot([{ slot: 'B' }])).toBe('A');
    expect(vacantSlot([{ slot: 'A' }, { slot: 'B' }])).toBeNull();
  });
});
