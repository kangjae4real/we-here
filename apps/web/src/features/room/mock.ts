// Synthetic sample rooms. Every coordinate, date and name here is made up.
// Copy and numbers follow the Figma Make design ("두 사람의 스친 순간 찾기").

export type Who = "a" | "b";
export type LatLng = { lat: number; lng: number };
export type PhotoPoint = LatLng & { id: string; who: Who };

/** One side of a 스친 순간: where the photo was taken, and where the approach trail starts. */
export type Shot = LatLng & { time: string; photo: string; from: LatLng };
export type Moment = {
  id: string;
  place: string;
  /** "2022.04.09 (토)" */
  date: string;
  /** Month on the replay timeline, "YYYY-MM". */
  month: string;
  a: Shot;
  b: Shot;
  distanceM: number;
  minutesApart: number;
};
export type TopPlace = LatLng & { rank: number; name: string; days: number };
export type HeatCell = LatLng & { level: 1 | 2 | 3; radiusM: number };
export type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  /** A room.moments id (`E-…`, as the chat API's evidenceIds): renders the "이 순간 리플레이에서 보기" chip. */
  evidence?: string;
  error?: boolean;
};
export type UploadResult = { ok: number; noLocation: number; noTime: number };

export type Room = {
  id: string;
  /** "ok" renders the room; "full"/"expired" render the S7/S8 gone screens. */
  status: "ok" | "full" | "expired";
  name: string;
  a: { nickname: string; photoCount: number };
  /** null until the invited person joins (S2). */
  b: { nickname: string; photoCount: number } | null;
  /** "2024.03.02" */
  firstMet: string;
  /** "2024.04.01" */
  expires: string;
  points: PhotoPoint[];
  moments: Moment[];
  /** ① 같은 곳, 다른 때: places both visited on different days. */
  samePlaceCount: number;
  topPlaces: TopPlace[];
  heat: HeatCell[];
  records: { oldest: string; latest: string; placesTogether: number };
  recentPhotos: { src: string; who: Who }[];
  /** Replay timeline bounds, "YYYY-MM" (oldest photo → first met). */
  timeline: { start: string; end: string };
  /** Mocked outcome of the next upload (EXIF is not parsed yet). */
  upload: UploadResult & { fails?: boolean };
  chat: { failsNext?: boolean; usedToday: number; limit: number };
};

const PHOTO = {
  aRiver: "/sample/a-river.jpg",
  bRiver: "/sample/b-river.jpg",
  cafe: "/sample/cafe.jpg",
  street: "/sample/street.jpg",
  awning: "/sample/awning.jpg",
  skyline: "/sample/skyline.jpg",
  bench: "/sample/bench.jpg",
};

const PLACES = [
  { name: "홍대", lat: 37.5572, lng: 126.9245 },
  { name: "연남동", lat: 37.5627, lng: 126.9255 },
  { name: "성수동", lat: 37.5446, lng: 127.0557 },
  { name: "서울숲", lat: 37.5444, lng: 127.0374 },
  { name: "여의도", lat: 37.5284, lng: 126.9346 },
  { name: "강남", lat: 37.4979, lng: 127.0276 },
  { name: "종로", lat: 37.5704, lng: 126.9921 },
  { name: "남산", lat: 37.5512, lng: 126.9882 },
  { name: "용산", lat: 37.5298, lng: 126.9648 },
  { name: "잠실", lat: 37.5112, lng: 127.0981 },
];

export const MAP_LABELS = PLACES;
const place = (name: string) =>
  PLACES.find((p) => p.name === name) ?? PLACES[0];

/** [lat, lng, count, spread m]: a dense spot (≤ 30 m, clusters on the map) or loose scatter (550–1000 m) around it. */
type Spot = [number, number, number, number];
// Shaped like the design's DOTS_A/DOTS_B + CLUSTERS: dense spots first so they seed the clusters.
const SPOTS: Record<Who, Spot[]> = {
  a: [
    [37.5572, 126.9245, 24, 30], // 홍대
    [37.5704, 126.9921, 12, 30], // 종로
    [37.5572, 126.9245, 7, 1000], // 홍대
    [37.5445, 126.9515, 5, 1000], // 마포
    [37.5704, 126.9921, 5, 1000], // 종로
    [37.5315, 126.94, 4, 1000], // 여의도
    [37.5446, 127.0557, 4, 1000], // 성수
    [37.5512, 126.9882, 3, 1000], // 남산
  ],
  b: [
    [37.4979, 127.0276, 18, 30], // 강남
    [37.5446, 127.0557, 15, 30], // 성수
    [37.5446, 127.0557, 6, 1000], // 성수
    [37.4979, 127.0276, 7, 1000], // 강남
    [37.5298, 126.9648, 5, 1000], // 용산
    [37.5112, 127.0981, 5, 1000], // 잠실
    [37.5284, 126.9346, 3, 1000], // 여의도
    [37.5714, 127.0094, 3, 1000], // 동대문
  ],
};

// Seeded scatter so server and client render the same points.
function makePoints(who: Who): PhotoPoint[] {
  let seed = who === "a" ? 7 : 19;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return SPOTS[who]
    .flatMap(([lat, lng, n, spread]) =>
      Array.from({ length: n }, () => {
        const angle = rand() * Math.PI * 2;
        // Loose dots keep clear of the dense spot so they don't merge into its cluster.
        const d =
          spread > 100 ? 550 + rand() * (spread - 550) : rand() * spread;
        return {
          lat: lat + (Math.sin(angle) * d) / 111_320,
          lng:
            lng +
            (Math.cos(angle) * d) / (111_320 * Math.cos((lat * Math.PI) / 180)),
        };
      }),
    )
    .map((p, i) => ({ ...p, id: `${who}-${i}`, who }));
}

const MOMENTS: Moment[] = [
  {
    id: "E-a1b2c3",
    place: "여의도 한강공원",
    date: "2022.04.09 (토)",
    month: "2022-04",
    a: {
      lat: 37.5279,
      lng: 126.9335,
      time: "15:12",
      photo: PHOTO.aRiver,
      from: { lat: 37.5312, lng: 126.9268 },
    },
    b: {
      lat: 37.5288,
      lng: 126.9357,
      time: "15:20",
      photo: PHOTO.bRiver,
      from: { lat: 37.5246, lng: 126.9431 },
    },
    distanceM: 210,
    minutesApart: 8,
  },
  {
    id: "E-d4e5f6",
    place: "성수동",
    date: "2023.08.15 (화)",
    month: "2023-08",
    a: {
      lat: 37.5443,
      lng: 127.053,
      time: "19:40",
      photo: PHOTO.cafe,
      from: { lat: 37.5478, lng: 127.0472 },
    },
    b: {
      lat: 37.5451,
      lng: 127.0577,
      time: "20:03",
      photo: PHOTO.awning,
      from: { lat: 37.5409, lng: 127.0641 },
    },
    distanceM: 450,
    minutesApart: 23,
  },
];

const TOP: TopPlace[] = [
  { ...place("성수동"), rank: 1, days: 14 },
  { ...place("여의도"), rank: 2, days: 9 },
  { ...place("홍대"), rank: 3, days: 6 },
];

const HEAT: HeatCell[] = [
  { ...place("성수동"), level: 3, radiusM: 900 },
  { ...place("여의도"), level: 2, radiusM: 700 },
  { ...place("홍대"), level: 2, radiusM: 600 },
  { ...place("남산"), level: 1, radiusM: 450 },
  { ...place("용산"), level: 1, radiusM: 400 },
  { ...place("강남"), level: 1, radiusM: 380 },
];

export const sampleRoom: Room = {
  id: "sample",
  status: "ok",
  name: "우리 둘의 지도",
  a: { nickname: "서연", photoCount: 128 },
  b: { nickname: "도윤", photoCount: 96 },
  firstMet: "2024.03.02",
  expires: "2024.04.01",
  points: [...makePoints("a"), ...makePoints("b")],
  moments: MOMENTS,
  samePlaceCount: 7,
  topPlaces: TOP,
  heat: HEAT,
  records: {
    oldest: "2019.06.02 · 홍대",
    latest: "2024.03.10 · 성수동",
    placesTogether: 23,
  },
  recentPhotos: [
    { src: PHOTO.cafe, who: "a" },
    { src: PHOTO.awning, who: "b" },
    { src: PHOTO.aRiver, who: "a" },
    { src: PHOTO.street, who: "b" },
    { src: PHOTO.skyline, who: "a" },
    { src: PHOTO.bench, who: "b" },
  ],
  timeline: { start: "2019-06", end: "2024-03" },
  upload: { ok: 112, noLocation: 12, noTime: 4 },
  chat: { usedToday: 3, limit: 20 },
};

// shortcut: room ids double as design-state fixtures until the API is wired up.
// /r/sample is the full demo; the others open one design state each (S1–S8, 06d).
const FIXTURES: Record<string, Partial<Room>> = {
  empty: {
    a: { nickname: "서연", photoCount: 0 },
    b: { nickname: "도윤", photoCount: 0 },
    points: [],
    moments: [],
    samePlaceCount: 0,
    topPlaces: [],
    heat: [],
    recentPhotos: [],
  },
  waiting: {
    b: null,
    points: makePoints("a"),
    moments: [],
    samePlaceCount: 0,
    topPlaces: [],
    heat: [],
  },
  "upload-fail": { upload: { ok: 0, noLocation: 0, noTime: 0, fails: true } },
  "low-location": { upload: { ok: 81, noLocation: 43, noTime: 4 } },
  "no-moments": { moments: [] },
  "chat-fail": { chat: { failsNext: true, usedToday: 3, limit: 20 } },
  "chat-limit": { chat: { usedToday: 20, limit: 20 } },
  full: { status: "full" },
  expired: { status: "expired" },
};

export function getRoom(id: string): Room {
  return { ...sampleRoom, ...FIXTURES[id], id };
}

export const suggestedQuestions = [
  "우리 처음 스친 곳 어디야?",
  "제일 자주 간 동네는?",
  "만나기 전 같은 날 뭐 했어?",
];

const CANNED: Record<string, Omit<ChatMessage, "id" | "role">> = {
  [suggestedQuestions[0]]: {
    text: "2022년 4월 9일, 둘 다 여의도 한강공원에 있었어. 고작 210m, 8분 차이로!",
    evidence: "E-a1b2c3",
  },
  [suggestedQuestions[1]]: {
    text: "성수동이야! 만난 뒤로 14일이나 같이 갔어.",
  },
  [suggestedQuestions[2]]: {
    text: "2023년 8월 15일, 둘 다 성수동에서 저녁을 보냈어. 23분 차이야.",
    evidence: "E-d4e5f6",
  },
};

export function cannedAnswer(
  question: string,
): Omit<ChatMessage, "id" | "role"> {
  return (
    CANNED[question] ?? {
      text: "음, 그건 기록에서 못 찾았어. 다르게 물어봐줄래?",
    }
  );
}
