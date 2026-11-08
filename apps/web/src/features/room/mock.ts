// Synthetic sample room. Every coordinate, date and name here is made up.

export type Who = "a" | "b";
export type LatLng = { lat: number; lng: number };
export type PhotoPoint = LatLng & { id: string; who: Who };
export type Shot = LatLng & { time: string; date: string };

export type ReplayEvent = {
  id: string;
  act: 1 | 2;
  /** Slider position, 0-100. */
  position: number;
  place: string;
  a: Shot;
  b: Shot;
  /** Act 1: "같은 날, 3시간 차이" / "{N}일 차이". */
  gap?: string;
  /** Act 2 (스친 순간). */
  distanceM?: number;
  minutesApart?: number;
  uncertain?: boolean;
};

export type HeatCell = LatLng & { place: string; days: number };
export type ChatMessage = { id: string; role: "user" | "ai"; text: string };

export const ACTS = [
  { act: 1, start: 0, end: 30, label: "같은 곳, 다른 때" },
  { act: 2, start: 30, end: 70, label: "스친 순간" },
  { act: 3, start: 70, end: 100, label: "만난 뒤 우리 기록" },
] as const;

const PLACES = [
  { name: "홍대입구", lat: 37.5572, lng: 126.9245 },
  { name: "연남동", lat: 37.5627, lng: 126.9255 },
  { name: "성수동", lat: 37.5446, lng: 127.0557 },
  { name: "서울숲", lat: 37.5444, lng: 127.0374 },
  { name: "여의도 한강공원", lat: 37.5284, lng: 126.9346 },
  { name: "강남역", lat: 37.4979, lng: 127.0276 },
  { name: "광화문", lat: 37.5759, lng: 126.9768 },
  { name: "이태원", lat: 37.5345, lng: 126.9946 },
  { name: "망원 한강공원", lat: 37.5551, lng: 126.8945 },
  { name: "잠실", lat: 37.5112, lng: 127.0981 },
];

export const MAP_LABELS = PLACES;

// Deterministic jitter so server and client render the same points.
function makePoints(who: Who, offset: number): PhotoPoint[] {
  return Array.from({ length: 40 }, (_, i) => {
    const place = PLACES[(i * 3 + offset) % PLACES.length];
    return {
      id: `${who}-${i}`,
      who,
      lat: place.lat + (((i * 37 + offset) % 13) - 6) * 0.0006,
      lng: place.lng + (((i * 53 + offset * 7) % 13) - 6) * 0.0008,
    };
  });
}

export const sampleRoom = {
  id: "sample",
  name: "지우 & 민준",
  metOn: "2023-05-20",
  a: { nickname: "지우", photoCount: 40 },
  b: { nickname: "민준", photoCount: 40 },
  points: [...makePoints("a", 0), ...makePoints("b", 5)],
};

const ACT1: ReplayEvent[] = [
  {
    place: "서울숲",
    a: { lat: 37.5447, lng: 127.0368, date: "2021년 5월 2일", time: "11:20" },
    b: { lat: 37.5439, lng: 127.0381, date: "2021년 5월 2일", time: "14:31" },
    gap: "같은 날, 3시간 차이",
  },
  {
    place: "망원 한강공원",
    a: { lat: 37.5556, lng: 126.8938, date: "2021년 7월 10일", time: "18:02" },
    b: { lat: 37.5547, lng: 126.8952, date: "2021년 8월 21일", time: "19:45" },
    gap: "42일 차이",
  },
  {
    place: "광화문",
    a: { lat: 37.5762, lng: 126.9761, date: "2021년 10월 3일", time: "13:10" },
    b: { lat: 37.5753, lng: 126.9774, date: "2021년 10월 9일", time: "15:55" },
    gap: "6일 차이",
  },
  {
    place: "이태원",
    a: { lat: 37.5349, lng: 126.9939, date: "2021년 12월 24일", time: "20:14" },
    b: { lat: 37.5341, lng: 126.9953, date: "2022년 2월 12일", time: "17:40" },
    gap: "50일 차이",
  },
  {
    place: "잠실",
    a: { lat: 37.5116, lng: 127.0975, date: "2022년 3월 1일", time: "12:05" },
    b: { lat: 37.5108, lng: 127.0988, date: "2022년 3월 1일", time: "17:22" },
    gap: "같은 날, 5시간 차이",
  },
  {
    place: "강남역",
    a: { lat: 37.4983, lng: 127.027, date: "2022년 11월 5일", time: "19:30" },
    b: { lat: 37.4975, lng: 127.0283, date: "2023년 2월 18일", time: "18:48" },
    gap: "105일 차이",
  },
].map((e, i) => ({
  ...e,
  id: `C-${i + 1}`,
  act: 1 as const,
  position: i * 5,
}));

const ENCOUNTERS: ReplayEvent[] = [
  {
    id: "E-a1b2c3",
    act: 2,
    position: 42,
    place: "여의도 한강공원",
    a: { lat: 37.5279, lng: 126.9335, date: "2022년 4월 9일", time: "15:12" },
    b: { lat: 37.5288, lng: 126.9357, date: "2022년 4월 9일", time: "15:20" },
    distanceM: 210,
    minutesApart: 8,
  },
  {
    id: "E-d4e5f6",
    act: 2,
    position: 55,
    place: "성수동 카페거리",
    a: { lat: 37.5443, lng: 127.055, date: "2022년 9월 17일", time: "13:41" },
    b: { lat: 37.5449, lng: 127.0564, date: "2022년 9월 17일", time: "13:47" },
    distanceM: 140,
    minutesApart: 6,
    uncertain: true,
  },
  {
    id: "E-0f9e8d",
    act: 2,
    position: 64,
    place: "홍대입구",
    a: { lat: 37.5569, lng: 126.9241, date: "2023년 1월 28일", time: "19:05" },
    b: { lat: 37.5574, lng: 126.925, date: "2023년 1월 28일", time: "19:13" },
    distanceM: 90,
    minutesApart: 8,
  },
];

export const replayEvents: ReplayEvent[] = [...ACT1, ...ENCOUNTERS];

export const heatCells: HeatCell[] = [
  { place: "연남동", days: 14 },
  { place: "성수동", days: 11 },
  { place: "망원 한강공원", days: 9 },
  { place: "여의도 한강공원", days: 8 },
  { place: "홍대입구", days: 7 },
  { place: "서울숲", days: 6 },
  { place: "광화문", days: 5 },
  { place: "강남역", days: 4 },
  { place: "이태원", days: 3 },
  { place: "잠실", days: 2 },
].map((c) => {
  const p = PLACES.find((place) => place.name === c.place) ?? PLACES[0];
  return { ...c, lat: p.lat, lng: p.lng };
});

export const chatModels = [
  { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { id: "qwen/qwen3-235b-a22b", label: "Qwen3 235B" },
  { id: "deepseek-ai/deepseek-v3.1", label: "DeepSeek V3.1" },
];

export const suggestedQuestions = [
  "우리가 처음 스친 곳은 어디야?",
  "스친 순간을 모두 알려줘",
  "만난 뒤 가장 자주 간 곳은?",
];

const CANNED: Record<string, string> = {
  [suggestedQuestions[0]]:
    "가장 먼저 가까이 있던 순간은 2022년 4월 9일 여의도 한강공원이에요. 지우님과 민준님의 사진이 210m, 8분 차이로 찍혔어요. [E-a1b2c3]",
  [suggestedQuestions[1]]:
    "만나기 전 스친 순간은 3번이에요. 여의도 한강공원 [E-a1b2c3], 성수동 카페거리 [E-d4e5f6](시간대 정보가 없어 시각은 추정이에요), 홍대입구 [E-0f9e8d].",
  [suggestedQuestions[2]]:
    "만난 뒤에는 연남동에 가장 여러 날(14일) 갔어요. 그다음은 성수동 11일, 망원 한강공원 9일이에요.",
};

export function cannedAnswer(question: string) {
  return (
    CANNED[question] ??
    "샘플 방에서는 미리 준비한 답만 보여 드려요. 예를 들어 성수동 카페거리에서 6분 차이로 스친 순간이 있어요. [E-d4e5f6]"
  );
}
