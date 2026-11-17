import type { Api } from './harness.js';

export interface Seat {
  id: string;
  token: string;
}

export interface TestRoom {
  roomId: string;
  inviteSecret: string;
  a: Seat;
}

export interface PairedRoom extends TestRoom {
  b: Seat;
}

export async function newRoom(api: Api): Promise<TestRoom> {
  const res = await api.call('createRoom', {
    json: { name: '우리 둘의 지도', nickname: '서연', metOn: '2024-03-02' },
  });
  if (res.status !== 201) throw new Error(`createRoom ${res.status}`);
  const { roomId, inviteSecret, participantId, token } = res.body;
  return { roomId, inviteSecret, a: { id: participantId, token } };
}

export async function pairedRoom(api: Api): Promise<PairedRoom> {
  const room = await newRoom(api);
  const res = await api.call('joinRoom', {
    params: { roomId: room.roomId },
    json: { nickname: '도윤', inviteSecret: room.inviteSecret },
  });
  if (res.status !== 201) throw new Error(`joinRoom ${res.status}`);
  return { ...room, b: { id: res.body.participantId, token: res.body.token } };
}

export async function revisionOf(api: Api, room: TestRoom): Promise<number> {
  const res = await api.call('getRoom', {
    params: { roomId: room.roomId },
    token: room.a.token,
  });
  return res.body.revision;
}

export const key = (n: number) => n.toString(16).padStart(64, '0');

export const jpeg = (size: number, fill = 1) => {
  const bytes = new Uint8Array(size).fill(fill);
  bytes.set([0xff, 0xd8, 0xff]);
  return bytes;
};

export function form(
  items: unknown,
  thumbs: Record<number, Uint8Array<ArrayBuffer>> = {},
  metaAsFile = false,
): FormData {
  const f = new FormData();
  const text = typeof items === 'string' ? items : JSON.stringify(items);
  if (metaAsFile) {
    f.set('meta', new Blob([text], { type: 'application/json' }), 'meta.json');
  } else {
    f.set('meta', text);
  }
  for (const [n, bytes] of Object.entries(thumbs)) {
    f.set(`thumb_${n}`, new Blob([bytes], { type: 'image/jpeg' }), `${n}.jpg`);
  }
  return f;
}

export interface Shot {
  lat: number;
  lng: number;
  at: string;
  offset?: string;
  thumb?: boolean;
}

let shotSerial = 1000;

export async function uploadShots(
  api: Api,
  room: { roomId: string },
  seat: Seat,
  shots: Shot[],
): Promise<string[]> {
  const items = shots.map((s, clientIndex) => ({
    clientIndex,
    dedupeKey: key((shotSerial += 1)),
    lat: s.lat,
    lng: s.lng,
    dateTimeOriginal: s.at,
    ...(s.offset ? { offsetTimeOriginal: s.offset } : {}),
  }));
  const thumbs = Object.fromEntries(
    shots.flatMap((s, i) => (s.thumb ? [[i, jpeg(200)]] : [])),
  );
  const res = await api.call('uploadPhotos', {
    params: { roomId: room.roomId },
    token: seat.token,
    body: form(items, thumbs),
  });
  if (res.status !== 200) throw new Error(`uploadPhotos ${res.status}`);
  return res.body.results.map((r: { photoId: string }) => r.photoId);
}
