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
