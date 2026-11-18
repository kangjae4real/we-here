# api

we-here의 NestJS 12 API 서버입니다. 방, 사진, 스냅샷(스친 순간·히트맵), AI 채팅을 맡습니다. web은 `/api/v1/*` 프록시를 거쳐 이 서버하고만 통신합니다.

이 문서의 명령은 모두 **저장소 루트**에서 실행합니다.

## 실행

API는 Postgres와 `apps/api/.env`가 있어야 뜹니다.

```bash
docker compose up -d db                  # Postgres 16, 127.0.0.1:5432
cp apps/api/.env.example apps/api/.env   # 처음 한 번
pnpm --filter api dev                    # 포트 4000 (PORT로 변경)
curl http://localhost:4000/health        # {"status":"ok","checks":{"db":"ok"}}
open http://localhost:4000/docs          # Swagger UI
```

루트 `pnpm dev`도 api의 `dev`(`nest start --watch`)를 함께 실행합니다.

서버는 시작할 때 `apps/api/.env`를 읽고, 마이그레이션(`migrations/*.sql`)을 자동으로 적용합니다. `.env.example`의 값 그대로면 외부 키 없이 모든 API가 동작합니다. AI 채팅과 장소 이름은 가짜 값을 돌려줍니다.

API를 직접 호출해 보려면 [Swagger로 API 써 보기](#swagger로-api-써-보기)와 [curl로 처음부터 끝까지 써 보기](#curl로-처음부터-끝까지-써-보기)를 보세요.

## Swagger로 API 써 보기

서버를 띄운 뒤 http://localhost:4000/docs 를 엽니다.

| 주소 | 내용 |
|---|---|
| `/docs` | Swagger UI |
| `/docs/openapi.json` | OpenAPI 3.1 문서 (JSON) |
| `/docs/openapi.yaml` | 같은 문서 (YAML) |

`API_DOCS=off`이거나 `NODE_ENV=production`이면 세 주소 모두 404입니다. Docker 이미지(`docker compose --profile app`)는 `NODE_ENV=production`이라 기본으로 꺼져 있습니다.

### 화면 읽는 법

- API는 태그로 묶여 있습니다. `system`, `rooms`, `photos`, `analysis`, `chat` 순서이고, 각 태그 설명에 해당하는 화면 번호가 있습니다.
- 각 API를 펼치면 설명, 파라미터, 요청 본문, 상태 코드별 응답이 나옵니다. 오류 응답의 설명에 어떤 `code`가 오는지 적혀 있습니다. FE는 `status`가 아니라 `code`로 화면을 나눕니다.
- 요청·응답의 **Schema** 탭이나 맨 아래 **Schemas** 섹션에서 필드별 설명, 형식, 예시 값을 볼 수 있습니다.
- 위쪽 **Servers**는 `http://localhost:4000`(API 직접 호출)으로 둡니다. `http://localhost:3000/api/v1`은 web이 함께 떠 있을 때만 쓸 수 있습니다.

### 인증 넣기

방 만들기, 초대 미리보기, 참여, 썸네일, `/health`를 뺀 모든 API에는 `X-Participant-Token` 헤더가 필요합니다.

1. `POST /rooms` → **Try it out** → **Execute**로 방을 만듭니다. 예시 본문을 그대로 보내도 됩니다.
2. 응답에서 `roomId`, `token`, `inviteSecret`을 복사해 둡니다. `token`은 이 응답에서만 받을 수 있습니다.
3. 오른쪽 위 **Authorize**를 누르고 `ParticipantToken`에 `token`을 붙여 넣습니다.
4. 이제 `roomId`를 넣으면 다른 API를 부를 수 있습니다. 토큰은 브라우저에 저장되어 새로고침해도 남아 있습니다.

### 두 사람으로 테스트하기

방에는 두 사람이 있고, 스친 순간과 AI 채팅은 두 사람이 모두 있어야 나옵니다. Swagger에서는 토큰을 바꿔 끼우면서 두 사람 역할을 합니다.

1. A(방을 만든 사람)의 토큰으로 Authorize 합니다.
2. `GET /rooms/{roomId}/invite`에 `roomId`와 `X-Invite-Secret`(`inviteSecret` 값)을 넣어 초대 미리보기를 확인합니다.
3. `POST /rooms/{roomId}/participants`에 `nickname`과 `inviteSecret`을 보내 B로 참여합니다. 응답의 `token`이 B의 토큰입니다.
4. B로 요청하려면 **Authorize** → **Logout** → B의 토큰을 붙여 넣습니다. 두 토큰은 메모장에 따로 적어 두세요.

### Swagger에서 하기 어려운 것

- **사진 업로드(`POST /rooms/{roomId}/photos`)**: multipart 요청입니다. `meta` JSON 배열과 `thumb_{clientIndex}` 파일 파트를 함께 보내야 하는데, Swagger UI에는 `thumb_*` 파일 입력칸이 나오지 않습니다. 아래 curl 예시로 올리세요.
- **AI 채팅(`POST /rooms/{roomId}/chat`)**: 응답이 NDJSON 스트림입니다. Swagger UI는 스트림이 끝난 뒤 전체를 한 번에 보여 줍니다. 한 줄씩 오는 모습을 보려면 `curl -N`을 씁니다.
- **썸네일(`GET /thumbs/{photoId}`)**: 스냅샷의 `thumbUrl`에 서명(`exp`, `sig`)이 들어 있습니다. 브라우저 주소창에 `http://localhost:4000` + `thumbUrl`을 붙여 여는 편이 쉽습니다.

## curl로 처음부터 끝까지 써 보기

방 만들기부터 채팅까지 한 번에 확인하는 순서입니다. `jq`가 필요합니다(`brew install jq`). `.env.example` 값(가짜 AI, 가짜 장소 이름)으로 띄운 서버 기준입니다.

```bash
B=http://localhost:4000

# 1. A가 방을 만든다
R=$(curl -s -X POST $B/rooms -H 'content-type: application/json' \
  -d '{"name":"테스트 방","nickname":"서연","metOn":"2024-03-02"}')
RID=$(echo "$R" | jq -r .roomId); TA=$(echo "$R" | jq -r .token); SEC=$(echo "$R" | jq -r .inviteSecret)

# 2. 초대 미리보기와 B 참여
curl -s $B/rooms/$RID/invite -H "X-Invite-Secret: $SEC"
TB=$(curl -s -X POST $B/rooms/$RID/participants -H 'content-type: application/json' \
  -d "{\"nickname\":\"도윤\",\"inviteSecret\":\"$SEC\"}" | jq -r .token)

# 3. 만나기 전(2022-04-09) 같은 곳에서 4분 차이로 찍은 사진을 한 장씩 올린다
#    dedupeKey는 64자리 16진수면 된다. 썸네일은 선택(40KB 이하 JPEG).
curl -s -X POST $B/rooms/$RID/photos -H "X-Participant-Token: $TA" \
  -F "meta=[{\"clientIndex\":0,\"dedupeKey\":\"$(printf '1%.0s' {1..64})\",\"lat\":37.5446,\"lng\":127.0559,\"dateTimeOriginal\":\"2022:04:09 15:12:03\"}];type=application/json" \
  -F "thumb_0=@./thumb.jpg;type=image/jpeg"     # 썸네일이 없으면 이 줄을 뺀다
curl -s -X POST $B/rooms/$RID/photos -H "X-Participant-Token: $TB" \
  -F "meta=[{\"clientIndex\":0,\"dedupeKey\":\"$(printf '2%.0s' {1..64})\",\"lat\":37.5450,\"lng\":127.0562,\"dateTimeOriginal\":\"2022:04:09 15:15:40\"}];type=application/json"

# 4. 스냅샷: encounters에 스친 순간이 하나 생긴다
curl -s $B/rooms/$RID/snapshot -H "X-Participant-Token: $TA" | jq '.encounters'

# 5. 두 사람 모두 AI 동의 후 채팅 (한 줄씩 스트리밍)
for T in $TA $TB; do
  curl -s -X PATCH $B/rooms/$RID/participants/me -H "X-Participant-Token: $T" \
    -H 'content-type: application/json' -d '{"aiConsent":true}'; echo
done
curl -s -N -X POST $B/rooms/$RID/chat -H "X-Participant-Token: $TA" \
  -H 'content-type: application/json' -d '{"content":"우리 언제 스쳤어?"}'

# 6. B도 같은 대화 기록을 본다
curl -s $B/rooms/$RID/chat/messages -H "X-Participant-Token: $TB" | jq '.messages[].content'
```

썸네일용 JPEG가 없으면 macOS에서 `sips -s format jpeg -Z 320 원본.png --out thumb.jpg`로 만들 수 있습니다.

## 로컬 개발 팁

- **`.env`를 바꾸면 서버를 다시 시작**해야 합니다. watch 모드는 소스 파일만 보고 `.env`는 시작할 때 한 번 읽습니다.
- **AI 오류 화면 확인**: `LLM_FAKE_SCENARIO`를 `length`(잘림), `mid_error`(중간 실패), `rate_limited`(429), `error`(502) 등으로 바꾸면 실제 모델 없이 오류 상황을 만들 수 있습니다. 스트리밍을 눈으로 보려면 `LLM_FAKE_DELAY_MS=300` 정도로 둡니다.
- **429 `rate_limited`가 나면**: 방 만들기·참여는 IP당 1시간 10번이 기본입니다. 테스트 중에는 `.env`에서 `ROOM_CREATE_LIMIT_PER_HOUR`를 크게 올립니다. 이 한도는 메모리에만 있어서 서버를 다시 시작해도 풀립니다.
- **DB 직접 보기**: `docker compose exec db psql -U postgres -d wehere`
- **로컬 데이터 전부 지우기**: `docker compose down -v`로 DB 볼륨까지 지운 뒤 `docker compose up -d db`. 서버를 다시 띄우면 마이그레이션이 다시 적용됩니다.
- **요청 추적**: 모든 응답의 `x-request-id` 헤더와 오류 본문의 `requestId`가 같은 값입니다. 500 `internal_error`는 서버 로그에 `requestId=...`와 스택이 남으니 이 값으로 찾습니다.

## 스크립트

`pnpm --filter api <명령>`으로 실행합니다.

| 명령 | 내용 |
|---|---|
| `dev` | `nest start --watch` (포트 4000) |
| `start` / `start:dev` / `start:debug` | 실행 / 파일 변경 감지(watch) / 디버그 + watch |
| `build` | `nest build` (결과물은 `dist/`) |
| `start:prod` | `node dist/main` (`build` 이후) |
| `test` / `test:watch` / `test:cov` | 단위 테스트 (Vitest) / watch / 커버리지 |
| `test:e2e` | e2e 테스트 (`test/*.e2e-spec.ts`) |
| `contract:emit` | 코드로 만든 OpenAPI 문서에서 `src/contract/*.gen.ts`(타입, 검증 스키마)를 다시 만듭니다 ([API 문서](#api-문서)) |
| `lint` | `oxlint src/ test/ scripts/` |
| `format` | Prettier (`src`, `test`) |

## 테스트

| 종류 | 파일 패턴 | 설정 파일 | 명령 |
|---|---|---|---|
| 단위 | `**/*.spec.ts` | `vitest.config.ts` | `pnpm --filter api test` |
| e2e | `**/*.e2e-spec.ts` | `vitest.config.e2e.ts` | `pnpm --filter api test:e2e` |

Vitest의 `globals`가 켜져 있어서 `describe`, `it`, `expect`를 import 없이 쓸 수 있습니다.

### 테스트별로 필요한 것

| 명령 | Postgres | env 설정 |
|---|---|---|
| `pnpm --filter api test` (단위 테스트) | 필요 없음 | 필요 없음 |
| `pnpm --filter api contract:emit` | 필요 없음 | 필요 없음 |
| `pnpm --filter api test:e2e` | **필요** | 필요 없음 (`TEST_DATABASE_URL`만 선택) |
| 서버를 띄워 Swagger로 직접 호출 | **필요** | `apps/api/.env` 필요 |

테스트는 `apps/api/.env`와 셸의 env를 읽지 않습니다. 필요한 값은 `test/env.ts`에 고정되어 있습니다. 그래서 `.env`에 실제 LLM 키를 넣어 두어도 테스트는 외부 서비스를 부르지 않고 `LLM_PROVIDER=fake`, `GEOCODER=fake`로 돕니다.

### e2e 테스트

```bash
docker compose up -d db
pnpm --filter api test:e2e
```

- e2e는 시작할 때 테스트 DB `wehere_test`를 **지우고 다시 만든 뒤** 마이그레이션을 적용합니다. 개발용 DB `wehere`는 건드리지 않습니다.
- 다른 Postgres를 쓰려면 `TEST_DATABASE_URL`로 바꿉니다. 이 계정은 DB를 만들고 지울 권한이 있어야 합니다. 테스트가 같은 서버의 `postgres` DB에 접속해 `wehere_test`를 지우고 다시 만들기 때문입니다.

  ```bash
  TEST_DATABASE_URL=postgres://user:pass@host:5432/wehere_test pnpm --filter api test:e2e
  ```

- 끝나면 `Contract coverage: 64/64`처럼 문서에 적힌 (API, 상태 코드) 조합을 몇 개 확인했는지 출력합니다. 하나라도 빠지면 테스트가 실패합니다.
- CI(`.github/workflows/ci.yml`)도 Postgres 16 서비스 컨테이너를 띄우고 같은 명령을 실행합니다.

## 환경 변수 (`apps/api/.env`)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `DATABASE_URL` | (필수) | Postgres 접속 주소 |
| `THUMB_SIGNING_SECRET` | (필수) | 썸네일 URL 서명 키. 32자 이상. 바꾸면 이미 발급한 썸네일 URL이 모두 무효가 됩니다 |
| `PORT` | `4000` | API 포트 |
| `API_DOCS` | `NODE_ENV=production`이면 `off`, 아니면 `on` | `/docs` Swagger UI와 `/docs/openapi.json`, `/docs/openapi.yaml` 제공 여부 |
| `ROOM_CREATE_LIMIT_PER_HOUR` | `10` | IP당 1시간 방 만들기 횟수. 방 참여에도 같은 값을 따로 적용합니다 |
| `INVITE_PREVIEW_LIMIT_PER_HOUR` | `60` | IP당 1시간 초대 미리보기 횟수 |
| `PHOTO_LIMIT_PER_PARTICIPANT` | `2000` | 참여자당 저장할 수 있는 사진 수 |
| `CHAT_ROOM_HOURLY_LIMIT` | `30` | 방마다 1시간 AI 답변 수 |
| `CHAT_DAILY_LIMIT` | `500` | 서비스 전체 하루(KST) AI 답변 수 |
| `GEOCODER` | `none` | 장소 이름. `none` 이름 없음 / `fake` 가짜 이름 / `naver` 네이버 역지오코딩 |
| `NCP_CLIENT_ID`, `NCP_CLIENT_SECRET` | | `GEOCODER=naver`일 때 필수 (NCP Maps) |
| `LLM_PROVIDER` | (없음) | `fake` 또는 `openai-compatible`. 비워 두면 서버는 뜨지만 채팅이 503 `server_misconfigured`를 줍니다 |
| `LLM_MODEL`, `LLM_API_KEY` | | `openai-compatible`일 때 필수 |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI 호환 엔드포인트 주소 |
| `LLM_FIRST_TOKEN_TIMEOUT_MS` | `30000` | 첫 응답까지 기다리는 시간 |
| `LLM_IDLE_TIMEOUT_MS` | `15000` | 응답 조각 사이에 기다리는 시간 |
| `LLM_FAKE_SCENARIO` | `ok` | `fake` 전용. `ok`, `length`, `mid_error`, `empty`, `rate_limited`, `error` 중 하나로 상황을 흉내 냅니다 |
| `LLM_FAKE_DELAY_MS` | `0` | `fake` 전용. 응답 조각 사이 지연. 스트리밍 화면을 볼 때 `300` 정도로 둡니다 |

### 실제 AI 모델로 테스트하기

`openai-compatible` 하나로 OpenAI Chat Completions 형식을 쓰는 서비스에 붙습니다. `apps/api/.env`에서 아래처럼 바꿉니다. 키는 `.env`에만 두고 커밋하지 않습니다.

```bash
LLM_PROVIDER=openai-compatible
LLM_API_KEY=...
# 서비스별 LLM_BASE_URL과 LLM_MODEL 예시 (모델 이름은 각 서비스 문서에서 확인)
# OpenAI       LLM_BASE_URL=https://api.openai.com/v1
# NVIDIA NIM   LLM_BASE_URL=https://integrate.api.nvidia.com/v1
# Gemini       LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_MODEL=...
```

채팅을 하려면 방에 두 사람이 있고, 두 사람 모두 `PATCH /rooms/{roomId}/participants/me`로 `aiConsent: true`를 보내야 합니다. 아니면 403 `ai_consent_required`를 받습니다.

## API 문서

API 문서(OpenAPI 3.1)는 코드에서 만듭니다. 원본은 컨트롤러의 Swagger 데코레이터, `src/contract/components.ts`(스키마), `src/contract/document.ts`(공통 설명)입니다.

- 서버를 띄우면 `/docs`(Swagger UI), `/docs/openapi.json`, `/docs/openapi.yaml`에서 볼 수 있습니다 (`API_DOCS`).
- 문서 파일은 저장소에 따로 두지 않습니다. 파일이 필요하면 서버를 띄우고 `/docs/openapi.json`이나 `/docs/openapi.yaml`을 받습니다.
- 스키마나 데코레이터를 바꾼 뒤에는 `pnpm --filter api contract:emit`을 실행해 `src/contract/types.gen.ts`, `src/contract/openapi.gen.ts`를 다시 만들고 함께 커밋합니다. 커밋된 파일이 코드와 다르면 단위 테스트가 실패합니다.
- 요청 본문 검증(Ajv)과 TS 타입도 같은 스키마에서 나옵니다. DTO 클래스는 따로 두지 않습니다.

## 코드 스타일

- ESM(`"type": "module"`, `module: nodenext`)이라 상대 경로 import에 확장자 `.js`를 붙입니다.

  ```ts
  import { createApp } from './app.js';
  ```

- lint: oxlint (`oxlint.json`)
- format: Prettier (`.prettierrc`: 작은따옴표, trailing comma `all`)
