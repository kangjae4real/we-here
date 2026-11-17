import { signThumb, thumbExp, thumbPath, verifyThumb } from './thumb.js';

const SECRET = 'test-secret-test-secret';
const ID = '9b2f4c1a-7d3e-4f80-a1b2-c3d4e5f60718';
const HOUR = 3600;
const at = (iso: string) => Date.parse(iso);

describe('thumbExp', () => {
  const farRoom = at('2030-01-01T00:00:00Z');

  it('is the same for every request within one hour', () => {
    const a = thumbExp(at('2026-11-17T10:00:01Z'), farRoom);
    const b = thumbExp(at('2026-11-17T11:00:00Z'), farRoom);
    expect(a).toBe(b);
    expect(a).toBe(at('2026-11-18T10:00:00Z') / 1000);
  });

  it('stays between 23 and 24 hours away', () => {
    const now = at('2026-11-17T10:00:00Z');
    expect(thumbExp(now, farRoom) - now / 1000).toBe(23 * HOUR);
    expect(thumbExp(now + 1, farRoom) - now / 1000).toBe(24 * HOUR);
  });

  it('never outlives the room', () => {
    const room = at('2026-11-17T12:30:00Z');
    expect(thumbExp(at('2026-11-17T10:00:00Z'), room)).toBe(room / 1000);
  });
});

describe('verifyThumb', () => {
  const now = at('2026-11-17T10:00:00Z');
  const exp = thumbExp(now, at('2030-01-01T00:00:00Z'));
  const check = (o: {
    id?: string;
    exp?: string;
    sig?: string;
    now?: number;
  }) =>
    verifyThumb(
      SECRET,
      o.id ?? ID,
      o.exp ?? String(exp),
      o.sig ?? signThumb(SECRET, o.id ?? ID, Number(o.exp ?? exp)),
      o.now ?? now,
    );

  it('accepts what thumbPath signs', () => {
    const url = new URL(thumbPath(SECRET, ID, exp), 'http://x');
    expect(url.pathname).toBe(`/thumbs/${ID}`);
    expect(
      verifyThumb(
        SECRET,
        ID,
        url.searchParams.get('exp')!,
        url.searchParams.get('sig')!,
        now,
      ),
    ).toBe('ok');
  });

  it('rejects a signature for another photo, exp or secret', () => {
    const sig = signThumb(SECRET, ID, exp);
    expect(check({ id: 'another', sig })).toBe('thumb_signature_invalid');
    expect(check({ exp: String(exp + HOUR), sig })).toBe(
      'thumb_signature_invalid',
    );
    expect(check({ sig: signThumb('other', ID, exp) })).toBe(
      'thumb_signature_invalid',
    );
  });

  it('rejects malformed exp and sig before computing anything', () => {
    expect(check({ exp: '-1' })).toBe('thumb_signature_invalid');
    expect(check({ sig: 'ABC' })).toBe('thumb_signature_invalid');
  });

  it('checks the signature before expiry, then expiry', () => {
    expect(check({ now: exp * 1000 })).toBe('thumb_signature_expired');
    expect(check({ now: exp * 1000 - 1 })).toBe('ok');
    expect(check({ now: exp * 1000, sig: '0'.repeat(64) })).toBe(
      'thumb_signature_invalid',
    );
  });

  it('refuses an exp further out than the server ever signs', () => {
    const far = Math.floor(now / 1000) + 24 * HOUR + 1;
    expect(check({ exp: String(far) })).toBe('thumb_signature_invalid');
  });
});
