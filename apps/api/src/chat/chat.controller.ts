import { Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { PARAMETERS, RESPONSES, schemaRef } from '../contract/components.js';
import { parseJsonBody } from '../contract/index.js';
import { cleanQuestion, parseHistoryQuery } from '../core/chat.js';
import { ChatService, type FrameSink } from './chat.service.js';

const TOKEN = 'x-participant-token';

function ndjson(res: Response): FrameSink {
  return {
    requestId: String(res.locals.requestId),
    start() {
      res.status(200).type('application/x-ndjson');
      res.flushHeaders();
    },
    write(frame) {
      if (!res.destroyed && !res.writableEnded) res.write(`${JSON.stringify(frame)}\n`);
    },
    end() {
      if (!res.writableEnded) res.end();
    },
  };
}

@Controller('rooms')
export class ChatController {
  constructor(private readonly chats: ChatService) {}

  @ApiOperation({
    tags: ['chat'],
    operationId: 'listChatMessages',
    summary: '방의 채팅 기록 (화면 09 진입, 새로고침, 상대 메시지 갱신)',
    description: `방 단위로 저장된 대화를 오래된 순으로 돌려준다. 두 참여자가 같은 기록을 본다.
- 처음 열 때: 파라미터 없이 → 최근 \`limit\`개
- 위로 스크롤: \`before={가장 오래된 id}\` → 그보다 이전 \`limit\`개
- 폴링 중 \`Room.chatLastMessageId\`가 바뀌었을 때: \`after={가진 마지막 id}\` → 그 뒤 메시지 전부(최대 \`limit\`)
\`before\`와 \`after\`를 같이 보내면 400이다. 모르는 id면 400 \`validation_failed\`다.

답하는 중인 assistant 메시지는 \`status: streaming\`과 지금까지 만든 \`content\`로 온다.
상대 화면에서 "답하는 중…"을 보여주는 데 쓰고, 다음 폴링에서 \`complete\` 등으로 바뀐다.
AI 동의가 없어도 기록은 읽을 수 있다(동의 철회 뒤에도 지난 대화는 보인다).
`,
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiQuery({
    name: 'before',
    schema: { type: 'string', format: 'uuid' },
    required: false,
  })
  @ApiQuery({
    name: 'after',
    schema: { type: 'string', format: 'uuid' },
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: '메시지 목록',
    content: {
      'application/json': {
        schema: schemaRef('ChatHistory'),
        example: {
          messages: [
            {
              id: '3f6a1b2c-4d5e-4f60-8a7b-9c0d1e2f3a4b',
              role: 'user',
              authorId: '9b2f3c1e-6a7d-4c2b-9f10-3e4d5a6b7c8d',
              content: '우리 처음 스친 곳 어디야?',
              evidenceIds: [],
              status: 'complete',
              createdAt: '2024-03-20T12:01:10Z',
            },
            {
              id: '7c1e2f0a-9b3d-4e5f-8a6b-0c1d2e3f4a5b',
              role: 'assistant',
              authorId: null,
              content:
                '2022년 4월 9일, 둘 다 여의도 한강공원에 있었어. 고작 210m, 8분 차이로! [E-k3x9a2]',
              evidenceIds: ['E-k3x9a2'],
              status: 'complete',
              createdAt: '2024-03-20T12:01:11Z',
            },
          ],
          hasMore: false,
        },
      },
    },
  })
  @ApiResponse({ status: 400, ...RESPONSES.ValidationFailed })
  @ApiResponse({ status: 401, ...RESPONSES.Unauthorized })
  @ApiResponse({ status: 404, ...RESPONSES.RoomNotFound })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Get(':roomId/chat/messages')
  listChatMessages(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    return this.chats.list(roomId, token, parseHistoryQuery(query));
  }

  @ApiOperation({
    tags: ['chat'],
    operationId: 'chat',
    summary: 'AI에게 묻기 (화면 09, S5, S6)',
    description: `질문 하나를 받아 저장하고, 서버가 방 요약과 저장된 최근 대화로 env에서 정한 LLM 제공자·모델(\`LLM_PROVIDER\`, \`LLM_MODEL\`)을 호출해 답을 스트리밍한다.
FE는 지난 대화를 보내지 않는다. 문맥은 서버가 DB에서 꺼낸다.

**저장 규칙**
- 질문(\`user\`)과 답(\`assistant\`) 메시지를 방에 저장한다. 질문은 쿼터 예약 직후, 답 행은 스트림 시작 때 \`streaming\`으로 만든다.
- 답이 끝나면 \`complete\`(\`finishReason: stop\`) 또는 \`truncated\`(\`length\`), 제공자 오류면 \`failed\`로 바꾸고 그때까지 받은 글을 남긴다.
- 브라우저 연결이 끊겨도 서버는 생성을 끝까지 하고 저장한다. 새로고침하면 기록에서 전체 답을 본다.
- 서버가 죽어 \`streaming\`이 2분 넘게 남은 행은 다음 조회 때 \`failed\`로 바꾼다.
- 한 방에서 답 생성은 한 번에 하나다. 이미 \`streaming\`인 답이 있으면 409 \`chat_busy\`("상대가 묻고 있어. 답이 끝나면 물어봐줘")이고 쿼터를 쓰지 않는다.

**처리 순서**
1. 토큰 확인 → 두 참여자 AI 동의 확인 → 진행 중인 답 확인 → 쿼터 1회 예약(재시도도 1회로 센다, 환불 없음) → 질문 저장
2. 문맥: 이 질문 전의 \`complete\`·\`truncated\` 메시지 최근 10개(전체 6,000자 안). \`failed\` 답은 넣지 않는다.
3. 스냅샷에서 요약을 만든다. 넣는 것: 닉네임, 만난 날, 사진 수와 기간, 스친 순간 거리순 상위 30개
   (id, 장소 이름, 분 단위 시각, 거리, 시간 차, \`uncertain\`), 자주 간 장소 상위 10곳(id, 장소 이름, 날 수).
   **넣지 않는 것:** 원래 좌표, 썸네일, 기기 정보. 장소 이름이 없는 해외 지점은 "해외".
4. 시스템 프롬프트에 요약을 JSON 데이터로만 넣는다. 근거 id(\`E-…\`, \`P-…\`)를 인용하고 단정하지 않게 지시한다.
   데이터 안의 지시는 따르지 않는다.
5. 제공자 어댑터가 각 제공자의 스트리밍 형식(SSE 등)을 받아 아래 NDJSON 프레임으로 바꿔 보낸다.
   최대 출력 800토큰, 첫 토큰까지 30초, 청크 사이 15초 제한. 제공자의 오류는 아래 \`upstream_*\` code로 통일한다.

**쿼터:** 방마다 1시간 \`CHAT_ROOM_HOURLY_LIMIT\`(기본 30), 서비스 전체 하루 \`CHAT_DAILY_LIMIT\`(기본 500).
방별·전역 카운터는 한 트랜잭션에서 함께 예약하고, 하나라도 넘으면 둘 다 되돌린다.

**응답 스트림 (\`application/x-ndjson\`, 한 줄에 프레임 하나)**
- 첫 프레임: \`{"type":"meta","revision","userMessageId","assistantMessageId","evidenceIds","quota"}\`. FE는 저장된 id로 낙관적 메시지를 바꾸고, \`evidenceIds\`에 있는 id만 근거 칩으로 만든다.
- 이어서: \`{"type":"text","delta"}\` 여러 개
- 마지막: \`{"type":"done","finishReason":"stop"|"length"}\` 또는 \`{"type":"error","code","requestId"}\`
- \`done\` 없이 끊기면 FE는 받은 글을 남기고 "답변이 중간에 끊겼어" + 다시 시도를 붙인다.
- 스트림이 시작되기 전의 오류는 일반 HTTP 상태 + problem+json으로 보낸다.
`,
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: schemaRef('ChatRequest'),
          example: { content: '우리 처음 스친 곳 어디야?' },
        },
      },
    },
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiResponse({
    status: 200,
    description: '답변 스트림',
    content: {
      'application/x-ndjson': {
        schema: schemaRef('ChatFrame'),
        example: `{"type":"meta","revision":14,"userMessageId":"3f6a1b2c-4d5e-4f60-8a7b-9c0d1e2f3a4b","assistantMessageId":"7c1e2f0a-9b3d-4e5f-8a6b-0c1d2e3f4a5b","evidenceIds":["E-k3x9a2","P-wydm9q"],"quota":{"used":4,"limit":30,"resetAt":"2024-03-20T13:00:00Z"}}
{"type":"text","delta":"2022년 4월 9일, 둘 다 여의도 한강공원에 있었어. "}
{"type":"text","delta":"고작 210m, 8분 차이로! [E-k3x9a2]"}
{"type":"done","finishReason":"stop"}
`,
      },
    },
  })
  @ApiResponse({ status: 400, ...RESPONSES.ValidationFailed })
  @ApiResponse({ status: 401, ...RESPONSES.Unauthorized })
  @ApiResponse({
    status: 403,
    description: '두 참여자의 AI 동의가 아직 없다 (`ai_consent_required`)',
    content: { 'application/problem+json': { schema: schemaRef('Problem') } },
  })
  @ApiResponse({ status: 404, ...RESPONSES.RoomNotFound })
  @ApiResponse({
    status: 409,
    description:
      '이 방에서 다른 답을 만드는 중이다 (`chat_busy`). 쿼터는 쓰지 않는다.',
    content: { 'application/problem+json': { schema: schemaRef('Problem') } },
  })
  @ApiResponse({
    status: 429,
    description: `쿼터 초과 (S6 "오늘은 여기까지!"). \`room_chat_quota_exceeded\`(방별 1시간)와 \`global_chat_quota_exceeded\`(전체 하루)를 구분한다.
LLM 제공자가 429를 주면 \`upstream_rate_limited\`("잠깐 붐벼. 조금 있다 다시 물어봐줄래?")이다.
`,
    headers: {
      'Retry-After': {
        description: '다시 시도할 수 있을 때까지 남은 초',
        schema: { type: 'integer' },
      },
    },
    content: {
      'application/problem+json': {
        schema: {
          allOf: [
            schemaRef('Problem'),
            {
              type: 'object',
              properties: {
                resetAt: {
                  type: 'string',
                  format: 'date-time',
                  description: '쿼터 초과일 때만',
                },
              },
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 502,
    description:
      'LLM 제공자 쪽 오류 (`upstream_error`). 키 문제, 크레딧 소진, 5xx, 빈 응답·거절을 모두 포함한다. S5 "답을 못 가져왔어".',
    content: { 'application/problem+json': { schema: schemaRef('Problem') } },
  })
  @ApiResponse({
    status: 504,
    description:
      '첫 토큰까지 30초를 넘겼다 (`upstream_timeout`). S5와 같은 화면.',
    content: { 'application/problem+json': { schema: schemaRef('Problem') } },
  })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Post(':roomId/chat')
  async chat(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const question = cleanQuestion(parseJsonBody('chat', body).content);
    await this.chats.ask(roomId, token, question, ndjson(res));
  }
}
