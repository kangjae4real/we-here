# we-here

프론트엔드(Next.js)와 백엔드(NestJS)를 한 저장소에서 관리하는 모노레포입니다. 패키지 관리는 pnpm workspace, 작업 실행은 Turborepo가 맡습니다.

| 영역 | 스택 |
|---|---|
| 모노레포 | pnpm 11 workspace, Turborepo 2.11 |
| `apps/web` | Next.js 16 (App Router, Turbopack, React Compiler), React 19, Tailwind CSS v4, shadcn/ui (Base UI), Storybook 10, Biome |
| `apps/api` | NestJS 12 (ESM), Vitest, oxlint, Prettier |

## 시작하기

### 1. 요구 사항

- **Node.js 24 이상** (루트 `package.json`의 `engines.node`)
- **pnpm 11.25.0** (루트 `package.json`의 `packageManager`)

`pnpm-workspace.yaml`에 `engineStrict: true`가 있어서 Node 24 미만에서는 `pnpm install`이 실패합니다. 버전 관리자(fnm, nvm, mise 등)는 루트의 `.node-version`을 읽어 Node 24를 고릅니다.

Node 24에 포함된 corepack을 켜두면, 저장소 안에서 `pnpm`을 실행할 때 `packageManager`에 적힌 버전이 자동으로 사용됩니다.

```bash
corepack enable
```

### 2. 의존성 설치

반드시 **저장소 루트**에서 설치합니다. 모든 앱의 의존성이 루트의 `pnpm-lock.yaml` 하나로 관리됩니다.

```bash
git clone https://github.com/kangjae4real/we-here.git
cd we-here
pnpm install
```

### 3. 개발 서버 실행

```bash
pnpm dev
```

| 서비스 | 주소 |
|---|---|
| web (Next.js) | http://localhost:3000 |
| api (NestJS) | http://localhost:4000 |
| Storybook | http://localhost:6006 |

Turborepo의 터미널 UI에서 세 서버의 로그가 각각 따로 표시됩니다. `Ctrl+C`를 누르면 모두 종료됩니다. Storybook은 시작할 때 브라우저 탭을 자동으로 엽니다.

Postgres가 필요하면 `docker compose up -d db`로 띄웁니다. 접속 주소는 `postgres://postgres:postgres@localhost:5432/wehere`입니다.

## API 환경 변수와 테스트

### 테스트별로 필요한 것

| 명령 | Postgres | env 설정 |
|---|---|---|
| `pnpm --filter api test` (단위 테스트) | 필요 없음 | 필요 없음 |
| `pnpm --filter api contract:emit` | 필요 없음 | 필요 없음 |
| `pnpm --filter api test:e2e` | **필요** | 필요 없음 (`TEST_DATABASE_URL`만 선택) |
| 서버를 띄워 Swagger로 직접 호출 | **필요** | `apps/api/.env` 필요 |

테스트는 `apps/api/.env`와 셸의 env를 읽지 않습니다. 필요한 값은 `apps/api/test/env.ts`에 고정되어 있습니다. 그래서 `.env`에 실제 LLM 키를 넣어 두어도 테스트는 외부 서비스를 부르지 않고 `LLM_PROVIDER=fake`, `GEOCODER=fake`로 돕니다.

### e2e 테스트

```bash
docker compose up -d db          # Postgres 16, 127.0.0.1:5432
pnpm --filter api test:e2e
```

- e2e는 시작할 때 테스트 DB `wehere_test`를 **지우고 다시 만든 뒤** 마이그레이션을 적용합니다. 개발용 DB `wehere`는 건드리지 않습니다.
- 다른 Postgres를 쓰려면 `TEST_DATABASE_URL`로 바꿉니다. 이 계정은 DB를 만들고 지울 권한이 있어야 합니다. 테스트가 같은 서버의 `postgres` DB에 접속해 `wehere_test`를 지우고 다시 만들기 때문입니다.

  ```bash
  TEST_DATABASE_URL=postgres://user:pass@host:5432/wehere_test pnpm --filter api test:e2e
  ```

- 끝나면 `Contract coverage: 64/64`처럼 문서에 적힌 (API, 상태 코드) 조합을 몇 개 확인했는지 출력합니다. 하나라도 빠지면 테스트가 실패합니다.
- CI(`.github/workflows/ci.yml`)도 Postgres 16 서비스 컨테이너를 띄우고 같은 명령을 실행합니다.

### 서버를 띄워 직접 테스트하기

```bash
docker compose up -d db
cp apps/api/.env.example apps/api/.env   # 처음 한 번
pnpm --filter api dev
open http://localhost:4000/docs          # Swagger UI
```

서버는 시작할 때 `apps/api/.env`를 읽고, 마이그레이션을 자동으로 적용합니다. `.env.example`의 값 그대로면 외부 키 없이 모든 API가 동작합니다. AI 채팅과 장소 이름은 가짜 값을 돌려줍니다.

Swagger UI에서 호출하는 순서는 다음과 같습니다.

1. `POST /rooms`로 방을 만듭니다.
2. 응답의 `token`을 복사합니다.
3. 오른쪽 위 **Authorize**에 붙여 넣습니다.

### 환경 변수 목록 (`apps/api/.env`)

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

## Docker 환경

`Dockerfile`과 `compose.yaml`로 web과 api를 프로덕션 이미지로 빌드해서 Postgres와 함께 실행합니다. 클라우드 인스턴스에도 같은 파일을 그대로 사용합니다. Docker가 필요합니다.

### 프로덕션 이미지로 실행

```bash
docker compose --profile app up -d --build
curl http://localhost:4000/health   # {"status":"ok","checks":{"db":"ok"}}
open http://localhost:3000
docker compose --profile app down
```

`--profile app` 없이 `docker compose up -d`만 실행하면 Postgres만 뜹니다. 네이버 지도 키는 빌드할 때 이미지에 들어가므로 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=... docker compose --profile app up -d --build`처럼 빌드 명령에 넘깁니다.

처음 빌드할 때는 의존성을 모두 내려받느라 몇 분 걸립니다. 이후에는 BuildKit 캐시를 재사용해서 `pnpm-lock.yaml`이 바뀌지 않으면 의존성 설치를 건너뜁니다.

## 디렉토리 구조

```
we-here/
├── apps/
│   ├── web/                      # Next.js 프론트엔드
│   │   ├── .storybook/           # Storybook 설정 (main.ts, preview.ts)
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── app/              # App Router (layout, page, globals.css, fonts.ts)
│   │   │   ├── components/ui/    # shadcn/ui 컴포넌트 + story
│   │   │   └── lib/utils.ts      # cn() 유틸
│   │   ├── biome.json            # lint/format 설정
│   │   ├── components.json       # shadcn/ui CLI 설정
│   │   └── next.config.ts
│   └── api/                      # NestJS 백엔드
│       ├── src/                  # main.ts, app.ts, 기능별 controller/service, core(순수 로직), contract(OpenAPI)
│       ├── test/                 # e2e 테스트 (*.e2e-spec.ts)
│       ├── nest-cli.json
│       ├── oxlint.json
│       └── vitest.config*.ts
├── package.json                  # 루트 스크립트 (turbo 호출)
├── pnpm-workspace.yaml           # workspace 범위, allowBuilds
├── pnpm-lock.yaml                # 모든 앱이 공유하는 lockfile
└── turbo.json                    # Turborepo 작업 정의
```

## Turborepo 구성

### pnpm workspace

`pnpm-workspace.yaml`은 `apps/*` 아래의 모든 폴더를 workspace 패키지로 등록합니다. 패키지 이름은 각 앱 `package.json`의 `name`인 `web`과 `api`입니다.

```yaml
packages:
  - "apps/*"
allowBuilds:
  esbuild: false
  sharp: false
  unrs-resolver: false
```

`allowBuilds`는 설치할 때 패키지의 빌드 스크립트(postinstall 등)를 실행할지 정하는 pnpm 11 설정입니다. 지금 등록된 세 패키지는 미리 빌드된 바이너리를 쓰기 때문에 모두 `false`로 둡니다.

> 각 앱 폴더 안에 `pnpm-workspace.yaml`이나 `pnpm-lock.yaml`을 두지 마세요. pnpm이 그 앱을 별도 workspace로 인식해서, 의존성이 루트 lockfile에 반영되지 않습니다.

### 작업(task) 정의

`turbo.json`에 정의된 작업은 다음과 같습니다. turbo는 각 패키지에서 같은 이름의 `package.json` 스크립트를 찾아 실행하고, 스크립트가 없는 패키지는 건너뜁니다.

| 작업 | 설정 | 실행되는 앱 |
|---|---|---|
| `build` | 의존 패키지를 먼저 빌드(`^build`), `.env*` 변경도 캐시 키에 포함, 결과물 `.next/**` 캐시 | web, api |
| `lint` | 의존 패키지의 lint를 먼저 실행(`^lint`) | web(Biome), api(oxlint) |
| `check-types` | 의존 패키지를 먼저 실행(`^check-types`) | 현재 없음 (스크립트를 정의한 앱이 없음) |
| `dev` | 캐시 안 함, 계속 실행되는 작업(`persistent`) | web, api |
| `storybook` | 캐시 안 함, 계속 실행되는 작업(`persistent`) | web |

`"ui": "tui"` 설정 때문에 여러 작업을 동시에 실행하면 작업별로 로그 창이 나뉜 터미널 UI가 뜹니다. 로그를 한 줄로 이어서 보고 싶으면 `--ui=stream`을 붙입니다.

### 특정 앱만 실행하기

```bash
# turbo로 실행 (캐시, 작업 의존성 적용)
pnpm exec turbo run dev --filter=web     # Next만 실행 (Storybook 제외)
pnpm exec turbo run build --filter=api

# pnpm으로 앱의 스크립트를 바로 실행
pnpm --filter web storybook
pnpm --filter api test
```

## 스크립트

### 루트

| 명령 | 내용 |
|---|---|
| `pnpm dev` | `turbo run dev storybook`: web, api 개발 서버와 Storybook을 함께 실행 |
| `pnpm build` | `turbo run build`: web, api 빌드 |
| `pnpm lint` | `turbo run lint`: web(Biome), api(oxlint) 검사 |
| `pnpm check-types` | `turbo run check-types`: 현재는 실행되는 작업이 없음 |
| `pnpm format` | Prettier로 모든 `ts`/`tsx`/`md` 파일 포맷 (web 파일도 포함) |

### web (`apps/web`)

| 명령 | 내용 |
|---|---|
| `dev` | `next dev` (포트 3000) |
| `build` / `start` | 프로덕션 빌드 / 실행 |
| `lint` | `biome check` |
| `format` | `biome format --write` |
| `storybook` | `storybook dev -p 6006` |
| `build-storybook` | 정적 Storybook을 `storybook-static/`에 빌드 |

### api (`apps/api`)

| 명령 | 내용 |
|---|---|
| `dev` | `nest start --watch` (포트 4000) |
| `start` / `start:dev` / `start:debug` | 실행 / 파일 변경 감지(watch) / 디버그 + watch |
| `build` | `nest build` (결과물은 `dist/`) |
| `start:prod` | `node dist/main` (`build` 이후) |
| `test` / `test:watch` / `test:cov` | 단위 테스트 (Vitest) / watch / 커버리지 |
| `test:e2e` | e2e 테스트 (`test/*.e2e-spec.ts`) |
| `contract:emit` | 코드(컨트롤러 데코레이터, `src/contract/components.ts`)로 만든 OpenAPI 문서를 `docs/api/openapi.yaml`과 `src/contract/*.gen.ts`에 쓴다. 서버는 같은 문서를 `/docs`(Swagger UI)와 `/docs/openapi.json`으로 보여 준다(`API_DOCS`) |
| `lint` | `oxlint src/ test/` |
| `format` | Prettier (`src`, `test`) |

## web

### 주요 설정

- **`next.config.ts`**: `cacheComponents`, `partialPrefetching`, `reactCompiler`를 켜두었습니다. CSS는 Turbopack 로더인 `@tailwindcss/turbopack`이 처리하므로 PostCSS 설정 파일이 없습니다.
- **경로 별칭**: `@/*`는 `src/*`를 가리킵니다 (`tsconfig.json`).
- **폰트**: `src/app/fonts.ts`에서 `next/font`로 Geist(`--font-sans`)와 Geist Mono(`--font-geist-mono`)를 정의합니다. `layout.tsx`와 Storybook이 이 파일을 함께 import하므로, 폰트를 바꿀 때는 여기만 수정하면 됩니다.
- **테마**: `src/app/globals.css`에 shadcn/ui 색상 토큰(라이트 `:root`, 다크 `.dark`)이 있습니다. 다크 모드는 `<html>`에 `dark` 클래스가 붙으면 적용됩니다.
- **lint/format**: Biome을 사용합니다 (`biome.json`).

### shadcn/ui

`components.json` 설정 기준으로 Base UI 기반의 `base-nova` 스타일을 씁니다. 컴포넌트는 `src/components/ui/`에 소스 코드로 추가되며, 그 파일을 직접 수정해서 쓰는 방식입니다.

**컴포넌트 추가하기**

```bash
pnpm --filter web exec shadcn add dialog
pnpm --filter web format
```

shadcn CLI는 세미콜론 없이 코드를 생성하기 때문에 Biome 포맷과 맞지 않습니다. 추가한 뒤에는 꼭 `format`을 실행하세요. 안 하면 `pnpm lint`가 실패합니다.

**컴포넌트 커스텀 방식**

- **base 수정**: 전체 디자인을 바꾸려면 `src/components/ui/*.tsx`의 variant(`cva`)를 직접 수정합니다.
- **조합 컴포넌트**: 여러 컴포넌트를 묶은 프로젝트 전용 컴포넌트는 `src/components/<이름>/`에 만듭니다.
- **덮어쓰기 주의**: `shadcn add --overwrite`를 실행하면 `ui/` 안의 컴포넌트 파일이 원본으로 덮어써집니다. 같은 폴더의 story 파일은 그대로 남습니다.

### Storybook

| 항목 | 설정 |
|---|---|
| 프레임워크 | `@storybook/nextjs-vite` (`next/font`, `next/image`, `next/navigation` 지원) |
| CSS | `@tailwindcss/vite` 플러그인 (`.storybook/main.ts`의 `viteFinal`) |
| 애드온 | `addon-docs` (모든 컴포넌트에 문서 페이지 자동 생성), `addon-a11y` (접근성 검사), `addon-themes` (라이트/다크 전환) |
| story 위치 | `src/**/*.stories.@(ts\|tsx)` |
| 기타 | App Router 모드(`nextjs.appDirectory: true`), 앱과 같은 폰트와 `globals.css` 적용 |

**story 작성 규칙**

- story는 컴포넌트 옆에 둡니다 (예: `src/components/ui/button.stories.tsx`).
- title은 shadcn 컴포넌트면 `"UI/<이름>"`, 직접 만든 조합 컴포넌트면 `"Components/<이름>"`으로 짓습니다.
- 예시는 `src/components/ui/button.stories.tsx`를 참고하세요.

툴바의 테마 버튼으로 라이트/다크를 바꿀 수 있습니다. 폰트는 Google Fonts CDN에서 불러오므로, 오프라인이면 대체 폰트로 보입니다.

## api

NestJS 12 앱이며 ESM(`"type": "module"`, `module: nodenext`)으로 설정돼 있습니다. 그래서 상대 경로로 import할 때 확장자 `.js`를 붙여야 합니다.

```ts
import { createApp } from './app.js';
```

### 실행

API는 `PORT` 환경변수가 없으면 **4000번 포트**를 씁니다. 루트 `pnpm dev`가 api의 `dev`(`nest start --watch`)도 함께 실행합니다. API만 띄우려면:

```bash
pnpm --filter api dev
curl http://localhost:4000/health   # {"status":"ok","checks":{"db":"ok"}}
```

Postgres와 `apps/api/.env`가 필요합니다. 준비 방법은 [API 환경 변수와 테스트](#api-환경-변수와-테스트)를 보세요.

### 테스트

| 종류 | 파일 패턴 | 설정 파일 | 명령 |
|---|---|---|---|
| 단위 | `**/*.spec.ts` | `vitest.config.ts` | `pnpm --filter api test` |
| e2e | `**/*.e2e-spec.ts` | `vitest.config.e2e.ts` | `pnpm --filter api test:e2e` |

e2e는 Postgres가 필요합니다. 자세한 내용은 [API 환경 변수와 테스트](#api-환경-변수와-테스트)를 보세요.

Vitest의 `globals`가 켜져 있어서 `describe`, `it`, `expect`를 import 없이 쓸 수 있습니다.

### 코드 스타일

- lint: oxlint (`oxlint.json`)
- format: Prettier (`.prettierrc`: 작은따옴표, trailing comma `all`)

## 브랜치와 커밋

- PR과 `develop`/`main` push마다 GitHub Actions(`.github/workflows/ci.yml`)가 Node 24에서 `pnpm lint`, api 단위·e2e 테스트, `docker compose --profile app build`를 실행합니다.
- 작업 브랜치는 `develop`에서 만들고, PR도 `develop`으로 올립니다.
- 커밋 메시지는 `chore: ...`, `docs: ...` 같은 Conventional Commits 형식을 따릅니다.

## 트러블슈팅

### `pnpm install`에서 `ERR_PNPM_IGNORED_BUILDS`가 난다

새로 추가한 의존성에 빌드 스크립트가 있는데, 실행해도 되는지 아직 정하지 않았다는 뜻입니다. pnpm이 루트 `pnpm-workspace.yaml`의 `allowBuilds`에 `<패키지>: set this to true or false`라는 줄을 자동으로 추가해 둡니다. 이 값을 `true`(실행) 또는 `false`(실행 안 함)로 바꾼 뒤 다시 설치하세요.

### `EADDRINUSE: address already in use` (포트 3000 또는 6006)

이전에 띄운 서버가 아직 떠 있는 경우입니다. 포트를 잡고 있는 프로세스를 찾아 종료합니다.

```bash
lsof -nP -iTCP:6006 -sTCP:LISTEN   # PID 확인
kill <PID>
```

### `pnpm lint`가 `apps/web/.omc/` 파일 때문에 실패한다

Claude Code 플러그인(oh-my-claudecode)이 만드는 상태 파일입니다. git은 루트 `.gitignore`로 이 폴더를 무시하지만, Biome은 루트 `.gitignore`를 읽지 않아서 검사 대상에 포함됩니다. 이 폴더는 지워도 됩니다.

```bash
rm -rf apps/web/.omc
```
