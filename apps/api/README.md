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

Swagger UI에서 호출하는 순서는 다음과 같습니다.

1. `POST /rooms`로 방을 만듭니다.
2. 응답의 `token`을 복사합니다.
3. 오른쪽 위 **Authorize**에 붙여 넣습니다.

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
