import { isDeepStrictEqual } from 'node:util';
import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { PARAMETERS, RESPONSES, SCHEMAS } from './components.js';

const DESCRIPTION = `we-here NestJS(\`apps/api\`) API 계약이다. 이 문서는 코드(컨트롤러 데코레이터, \`src/contract/components.ts\`, \`src/contract/document.ts\`)에서 생성된다. 서버를 띄우면 \`/docs\`에서 Swagger UI로 볼 수 있다.

**근거 자료**
- Figma Make 프로토타입 "두 사람의 스친 순간 찾기" (화면 01~10, 상태 S1~S8)
- \`docs/designs/we-here.md\`의 API 계약과 수용 항목(O3, O6, O12, O14, O23, X3, X5, X6, X8, X9, E2, E3, E9, E10, E21, E22, E27, G1)

**공통 규칙**
- 브라우저는 API를 직접 부르지 않는다. web의 \`next.config.ts\` rewrites가 \`/api/v1/*\`를 이 API로 프록시한다.
  이 문서의 경로에는 \`/api/v1\` 접두어가 없다.
- 인증: \`X-Participant-Token\` 헤더. 예외는 \`GET /health\`, \`POST /rooms\`, \`GET /rooms/{roomId}/invite\`,
  \`POST /rooms/{roomId}/participants\`, \`GET /thumbs/{photoId}\`(서명으로 인증) 다섯 개다.
- 오류 본문은 모두 \`application/problem+json\`(\`Problem\`)이고, 화면 분기는 \`status\`가 아니라 \`code\`로 한다.
- 토큰이 없거나 이 방의 어떤 참여자와도 맞지 않으면 **401 \`invalid_token\`만** 준다.
  403은 권한 거부(남의 사진, 썸네일 서명, 초대 비밀값, AI 동의)에만, 404는 대상이 없을 때만 쓴다.
- 방을 바꾸는 요청(업로드, 삭제, 참여, 나가기, 내보내기, 만난 날 수정, AI 동의 변경)은 행이 하나 이상 바뀌면
  \`rooms.revision\`을 정확히 1 올리고 새 \`revision\`을 응답에 담는다.
- 채팅 메시지는 \`revision\`을 올리지 않는다(스냅샷과 무관). 상대의 새 메시지는 \`GET /rooms/{roomId}\`의 \`chatLastMessageId\`로 알아챈다.
- JSON 응답에는 \`Cache-Control: no-store\`, 모든 응답에는 \`X-Content-Type-Options: nosniff\`를 붙인다.
- 모든 응답 헤더와 오류 본문에 \`x-request-id\`(\`requestId\`)가 있다.

**프론트엔드는 이 API하고만 통신한다**
- 외부 서비스 호출(LLM, 네이버 역지오코딩)은 모두 이 API가 서버에서 한다. 키는 API 서버에만 있다.
- AI 채팅도 이 API의 \`POST /rooms/{roomId}/chat\`이 맡는다. Next.js 채팅 Route Handler는 두지 않는다.
- 채팅 모델은 서버 env로 하나만 고른다. 모델 선택 옵션과 모델 관련 요청 필드는 없다.
- 채팅 기록은 방 단위로 서버에 저장하고 두 참여자가 같은 대화를 본다. 방이 만료되면 함께 지운다.
- **LLM 제공자는 아직 정하지 않았다.** 이 계약은 제공자와 무관하게 만든다.
  서버는 \`LlmProvider\` 인터페이스(스트리밍 생성 하나) 뒤에 제공자별 어댑터를 두고,
  env \`LLM_PROVIDER\`(예: \`nvidia\`, \`openai\`, \`anthropic\`, \`gemini\`), \`LLM_MODEL\`, \`LLM_API_KEY\`,
  \`LLM_BASE_URL\`(OpenAI 호환 엔드포인트일 때만)로 고른다. 제공자를 바꿔도 요청·응답·오류 code는 그대로다.
  제공자 이름과 모델 이름은 응답에 싣지 않는다.
- 예외: 네이버 지도 JS SDK와 지도 타일은 브라우저가 네이버에서 직접 받는다(지도 SDK 구조상 프록시할 수 없다).

**이 API로 오지 않는 것**
- "위치 없음 / 촬영 시각 없음" 집계(화면 06c)는 브라우저가 EXIF를 읽고 걸러낸 결과라 API로 오지 않는다.
`;

function documentConfig(): Omit<OpenAPIObject, 'paths'> {
  const base = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle('we-here API')
    .setVersion('0.1.0-draft')
    .setDescription(DESCRIPTION)
    .addServer('http://localhost:4000', '로컬 API 직접 호출')
    .addServer(
      'http://localhost:3000/api/v1',
      'web 프록시 경유 (브라우저가 쓰는 경로)',
    )
    .addTag('system', '상태 확인')
    .addTag('rooms', '방 만들기, 초대, 참여, 설정 (화면 01~04, 10, S2, S7, S8)')
    .addTag('photos', '사진 메타데이터와 썸네일 업로드·삭제 (화면 06a~06d, S3)')
    .addTag(
      'analysis',
      '기록, 리플레이, 스친 순간, 히트맵 데이터 (화면 05, 07~08, S1, S4)',
    )
    .addTag(
      'chat',
      'AI 채팅과 방별 대화 기록 (화면 09, S5, S6). 모델은 서버에서 고정한다.',
    )
    .addSecurity('ParticipantToken', {
      type: 'apiKey',
      in: 'header',
      name: 'X-Participant-Token',
      description:
        '방 만들기·참여 응답으로 받은 참여자 토큰. FE는 `localStorage`에 방별로 저장한다.',
    })
    .addSecurityRequirements('ParticipantToken')
    .build();
  return structuredClone({
    ...base,
    info: {
      title: base.info.title,
      version: base.info.version,
      summary:
        "두 사람의 사진 위치로 '스친 순간'을 찾는 we-here의 NestJS API",
      description: base.info.description,
    },
    components: {
      ...base.components,
      parameters: PARAMETERS,
      responses: RESPONSES,
      schemas: SCHEMAS,
    },
  });
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  return tidy(SwaggerModule.createDocument(app, documentConfig()));
}

export function serveApiDocs(app: INestApplication): void {
  SwaggerModule.setup('docs', app, () => buildOpenApiDocument(app), {
    jsonDocumentUrl: 'docs/openapi.json',
    yamlDocumentUrl: 'docs/openapi.yaml',
  });
}

type Json = { [key: string]: any };

const OPERATION_KEYS = [
  'tags',
  'operationId',
  'summary',
  'description',
  'security',
  'parameters',
  'requestBody',
  'responses',
];

/**
 * What the decorators cannot say: shared parameters and responses become
 * `$ref`s again, and the empty `parameters` list and the `type: string` that
 * ApiHeader adds beside a `$ref` are dropped.
 */
function tidy(doc: OpenAPIObject): OpenAPIObject {
  const shared = (kind: 'parameters' | 'responses', node: Json) => {
    for (const [name, component] of Object.entries(doc.components![kind]!)) {
      if (isDeepStrictEqual(node, component)) {
        return { $ref: `#/components/${kind}/${name}` };
      }
    }
    return node;
  };
  const paths: Json = {};
  for (const [path, item] of Object.entries(doc.paths)) {
    paths[path] = {};
    for (const [method, operation] of Object.entries(item as Json)) {
      const { parameters = [], responses, ...rest } = operation as Json;
      const tidied: Json = { ...rest, responses: {} };
      if (parameters.length) {
        tidied.parameters = parameters.map((p: Json) => {
          if (p.schema?.$ref) delete p.schema.type;
          return shared('parameters', p);
        });
      }
      for (const [status, response] of Object.entries(responses as Json)) {
        tidied.responses[status] = shared('responses', response);
      }
      paths[path][method] = ordered(tidied, OPERATION_KEYS);
    }
  }
  const { securitySchemes, parameters, responses, schemas } = doc.components!;
  return ordered(
    {
      ...doc,
      paths,
      components: { securitySchemes, parameters, responses, schemas },
    },
    ['openapi', 'info', 'servers', 'tags', 'security', 'paths', 'components'],
  ) as OpenAPIObject;
}

function ordered(node: Json, keys: string[]): Json {
  const out: Json = {};
  for (const key of keys) if (key in node) out[key] = node[key];
  return Object.assign(out, node);
}
