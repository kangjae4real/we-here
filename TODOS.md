# TODOS

## Web (apps/web)

### 스친 순간 카드 이미지 저장/공유

**What:** 리플레이의 스친 순간 카드(두 사람 사진 + 날짜·장소·거리)를 PNG로 만들어 Web Share API로 공유하거나 저장한다.

**Why:** 사용자가 결과를 인스타 스토리나 카톡으로 퍼뜨리면 그 자체가 앱 홍보가 된다. 발표가 끝난 뒤에도 결과물이 남는다.

**Context:** /office-hours D3에서 "우연 카드"를 대표 장면으로 고르지 않았고(수렴 리플레이 + 히트맵 + 챗봇 선택), /autoplan CEO 단계(2026-11-08, 후보 E5)에서 사용자 선택을 존중해 미뤘다. 카드 컴포넌트는 `docs/designs/we-here.md`의 리플레이 항목에 이미 있으므로, 그 DOM을 canvas로 그리거나 별도 canvas 레이아웃으로 그려서 `navigator.share({ files })`로 넘기면 된다. iOS Safari는 파일 공유를 지원하지만 데스크톱 Chrome은 지원 여부가 다르니 다운로드 대체 경로가 필요하다.

**Effort:** M (human) / S (CC+gstack)
**Priority:** P3
**Depends on:** 리플레이 스친 순간 카드 구현(2주차)

### AI 카드 내레이션

**What:** LLM이 리플레이의 스친(가까운) 순간 카드마다 1~2줄 내레이션과 3막 챕터 캡션을 만들고, 방 `revision` 단위로 캐시한다.

**Why:** AI가 대표 장면 안으로 들어가서 "지도 + 챗봇" 조합보다 차별점이 생긴다. 호출은 revision당 1회라 비용이 낮고, 데모 모드는 캐시를 `room.json`에 그대로 담으면 된다.

**Context:** /autoplan CEO 단계(2026-11-08) Claude 리뷰어 M2 제안. FE 과부하 때문에 미뤘다(Taste). `/summary` 생성 코드와 채팅 route의 NVIDIA 호출을 재사용하면 된다. 채팅은 사용자 요구라 그대로 둔다.

**Effort:** M (human) / S (CC+gstack)
**Priority:** P3
**Depends on:** 4주차 채팅 route와 `/summary` 완료

### DESIGN.md 정리

**What:** 화면이 나온 뒤 색·서체·간격·반경 토큰과 화면 문구표를 `DESIGN.md` 하나로 모은다(`/design-consultation`).

**Why:** 지금은 토큰이 `globals.css`(D17)에, 문구가 계획 문서의 문구표(D14)에 나뉘어 있다. 발표 뒤에도 계속 만들 거라면 기준 문서가 하나 있어야 한다.

**Pros:** 이후 디자인 리뷰가 같은 어휘로 비교한다. **Cons:** 5주 안에는 시간을 쓸 가치가 낮다.

**Context:** /autoplan Design 단계(2026-11-08)에서 디자인 방향이 잠정안이라 미뤘다(NOT in scope).

**Effort:** S (human) / S (CC+gstack)
**Priority:** P3
**Depends on:** 3주차 화면 완성

## API (apps/api)

### API 원본 직접 호출 차단

**What:** Next `proxy.ts`가 rewrite 요청에 공유 시크릿 헤더를 붙이고, API는 그 헤더가 없는 요청을 거부한다.

**Why:** API 원본 주소가 공개돼 있어 Vercel을 건너뛰고 `X-Forwarded-For`를 꾸며 IP 제한을 피할 수 있다. 지금은 전역 하루 상한(X5, E22)이 실제 방어선이다.

**Pros:** IP 제한이 실제로 동작한다. **Cons:** 프록시 설정이 하나 늘고, 로컬 개발에도 같은 시크릿이 필요하다.

**Context:** /autoplan Eng 단계(2026-11-08) Claude 리뷰어 F6 선택안. E6에서 "최선 노력"으로 문서화하고 미뤘다.

**Effort:** S (human) / S (CC+gstack)
**Priority:** P3
**Depends on:** X10 배포 후 IP 확인

