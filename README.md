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
| Storybook | http://localhost:6006 |

Turborepo의 터미널 UI에서 두 서버의 로그가 각각 따로 표시됩니다. `Ctrl+C`를 누르면 둘 다 종료됩니다. Storybook은 시작할 때 브라우저 탭을 자동으로 엽니다.

`pnpm dev`는 API를 띄우지 않습니다. API는 DB와 함께 Docker로 실행할 예정이라 의도적으로 뺐습니다. 지금 API만 따로 실행하는 방법은 [api](#api) 섹션을 참고하세요.

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
│       ├── src/                  # main.ts, app.module.ts, controller/service, *.spec.ts
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
| `dev` | 캐시 안 함, 계속 실행되는 작업(`persistent`) | web |
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
| `pnpm dev` | `turbo run dev storybook`: web 개발 서버와 Storybook을 함께 실행 |
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
| `start` / `start:dev` / `start:debug` | 실행 / 파일 변경 감지(watch) / 디버그 + watch |
| `build` | `nest build` (결과물은 `dist/`) |
| `start:prod` | `node dist/main` (`build` 이후) |
| `test` / `test:watch` / `test:cov` | 단위 테스트 (Vitest) / watch / 커버리지 |
| `test:e2e` | e2e 테스트 (`test/*.e2e-spec.ts`) |
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
import { AppModule } from './app.module.js';
```

### 실행

API는 `PORT` 환경변수가 없으면 **3000번 포트**를 쓰는데, web과 같은 포트라서 함께 띄우면 충돌합니다. 로컬에서 직접 실행할 때는 포트를 지정하세요.

```bash
PORT=4000 pnpm --filter api start:dev
curl http://localhost:4000/   # Hello World!
```

### 테스트

| 종류 | 파일 패턴 | 설정 파일 | 명령 |
|---|---|---|---|
| 단위 | `**/*.spec.ts` | `vitest.config.ts` | `pnpm --filter api test` |
| e2e | `**/*.e2e-spec.ts` | `vitest.config.e2e.ts` | `pnpm --filter api test:e2e` |

Vitest의 `globals`가 켜져 있어서 `describe`, `it`, `expect`를 import 없이 쓸 수 있습니다.

### 코드 스타일

- lint: oxlint (`oxlint.json`)
- format: Prettier (`.prettierrc`: 작은따옴표, trailing comma `all`)

## 브랜치와 커밋

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
