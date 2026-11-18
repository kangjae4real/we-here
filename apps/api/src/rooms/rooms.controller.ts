import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Ip,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { CONFIG, type Config } from '../config.js';
import { PARAMETERS, RESPONSES, schemaRef } from '../contract/components.js';
import { parseJsonBody } from '../contract/index.js';
import {
  checkMetOn,
  cleanText,
  type FieldIssue,
  orThrow,
} from '../core/input.js';
import { RateLimiter } from '../http/rate-limit.js';
import { RoomsService } from './rooms.service.js';

const TOKEN = 'x-participant-token';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly limits: RateLimiter,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @ApiOperation({
    tags: ['rooms'],
    operationId: 'createRoom',
    summary: '방 만들기 (화면 02a~02c)',
    description: `방을 만들고 만든 사람을 참여자 A로 자동 참여시킨다.
응답의 \`token\`은 이 응답에서만 받을 수 있다(서버는 SHA-256 해시만 저장한다).
초대 링크는 FE가 \`/r/{roomId}#i={inviteSecret}\`, 내 다른 기기 링크는 \`/r/{roomId}#t={token}\`으로 만든다.
IP당 시간당 \`ROOM_CREATE_LIMIT_PER_HOUR\`회(기본 10)로 제한한다.
`,
    security: [],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: schemaRef('CreateRoomRequest'),
          example: {
            name: '우리 둘의 지도',
            nickname: '서연',
            metOn: '2024-03-02',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '생성됨',
    content: {
      'application/json': {
        schema: schemaRef('CreateRoomResponse'),
        example: {
          roomId: 'Zk3uP1xQx0aN8sYbVb2c9w',
          participantId: '6f1c2a9e-1c7b-4c1e-9a40-0b6f6e1f3a11',
          token: 'Q2l0eS1vZi1saWdodHMtYW5kLXJpdmVy',
          inviteSecret: '8fk2-syQvT0pLx3mR9aW1bg',
          expiresAt: '2024-04-01T00:00:00Z',
          revision: 1,
        },
      },
    },
  })
  @ApiResponse({ status: 400, ...RESPONSES.ValidationFailed })
  @ApiResponse({ status: 429, ...RESPONSES.RateLimited })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Post()
  createRoom(@Ip() ip: string, @Body() body: unknown) {
    this.limits.take('createRoom', ip, this.config.roomCreateLimitPerHour);
    const b = parseJsonBody('createRoom', body);
    const issues: FieldIssue[] = [];
    const input = {
      name: cleanText(b.name, 'name', issues),
      nickname: cleanText(b.nickname, 'nickname', issues),
      metOn: checkMetOn(b.metOn, Date.now(), issues),
    };
    return this.rooms.createRoom(orThrow(input, issues));
  }

  @ApiOperation({
    tags: ['rooms'],
    operationId: 'getInvitePreview',
    summary: '초대 미리보기 (화면 04, S7, S8)',
    description: `초대 링크로 들어온 사람에게 보여줄 정보다. 토큰이 필요 없고 초대 비밀값으로 확인한다.
\`status\`가 \`full\`이면 FE는 S7 "이 방은 이미 두 명이 꽉 찼어"를 보여준다.
만료된 방은 404 \`room_expired\`(S8)이다.
`,
    security: [],
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiHeader({
    name: 'X-Invite-Secret',
    required: true,
    description: '초대 링크 fragment `#i=` 뒤의 값',
    schema: schemaRef('Secret'),
  })
  @ApiResponse({
    status: 200,
    description: '미리보기',
    content: {
      'application/json': {
        schema: schemaRef('InvitePreview'),
        example: {
          roomId: 'Zk3uP1xQx0aN8sYbVb2c9w',
          name: '우리 둘의 지도',
          inviterNickname: '서연',
          metOn: '2024-03-02',
          status: 'open',
          vacantSlot: 'B',
        },
      },
    },
  })
  @ApiResponse({ status: 403, ...RESPONSES.InviteInvalid })
  @ApiResponse({ status: 404, ...RESPONSES.RoomNotFound })
  @ApiResponse({ status: 429, ...RESPONSES.RateLimited })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Get(':roomId/invite')
  getInvitePreview(
    @Ip() ip: string,
    @Param('roomId') roomId: string,
    @Headers('x-invite-secret') secret: string | undefined,
  ) {
    this.limits.take(
      'getInvitePreview',
      ip,
      this.config.invitePreviewLimitPerHour,
    );
    return this.rooms.getInvitePreview(roomId, secret);
  }

  @ApiOperation({
    tags: ['rooms'],
    operationId: 'joinRoom',
    summary: '초대받은 사람 입장 (화면 04)',
    description: `참여자 B로 들어온다. 방 행을 잠근 뒤 처리하므로 동시에 두 명이 들어와도 한 명만 성공한다.
IP당 시간당 10회 제한은 \`POST /rooms\`와 같다.
`,
    security: [],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: schemaRef('JoinRoomRequest'),
          example: {
            nickname: '도윤',
            inviteSecret: '8fk2-syQvT0pLx3mR9aW1bg',
          },
        },
      },
    },
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiResponse({
    status: 201,
    description: '참여 완료',
    content: { 'application/json': { schema: schemaRef('JoinRoomResponse') } },
  })
  @ApiResponse({ status: 400, ...RESPONSES.ValidationFailed })
  @ApiResponse({ status: 403, ...RESPONSES.InviteInvalid })
  @ApiResponse({ status: 404, ...RESPONSES.RoomNotFound })
  @ApiResponse({
    status: 409,
    description: '정원(2명)이 이미 찼다 (S7)',
    content: {
      'application/problem+json': {
        schema: schemaRef('Problem'),
        example: {
          type: 'https://we-here.app/problems/room_full',
          title: 'Room is full',
          status: 409,
          code: 'room_full',
          requestId: '7c0e2b1d-5a8f-4e7a-9b1d-2f6c3e8a9d10',
        },
      },
    },
  })
  @ApiResponse({ status: 429, ...RESPONSES.RateLimited })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Post(':roomId/participants')
  joinRoom(
    @Ip() ip: string,
    @Param('roomId') roomId: string,
    @Body() body: unknown,
  ) {
    this.limits.take('joinRoom', ip, this.config.roomCreateLimitPerHour);
    const b = parseJsonBody('joinRoom', body);
    const issues: FieldIssue[] = [];
    const nickname = cleanText(b.nickname, 'nickname', issues);
    return this.rooms.joinRoom(
      roomId,
      orThrow({ nickname, inviteSecret: b.inviteSecret }, issues),
    );
  }

  @ApiOperation({
    tags: ['rooms'],
    operationId: 'getRoom',
    summary: '방 정보 (상단 바, 기록 탭 숫자, 방 설정, 폴링)',
    description: `방 화면은 이전 응답이 끝나고 10초 뒤 이 요청을 다시 보낸다(겹치지 않는 폴링).
\`revision\`이 알고 있는 값보다 커지면 \`GET /rooms/{roomId}/snapshot\`을 다시 받는다.
상대가 아직 없으면 \`participants\`가 1명이다(S2). 404를 받으면 FE는 저장된 토큰을 지운다.
`,
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiResponse({
    status: 200,
    description: '방 정보',
    content: {
      'application/json': {
        schema: schemaRef('Room'),
        example: {
          roomId: 'Zk3uP1xQx0aN8sYbVb2c9w',
          name: '우리 둘의 지도',
          metOn: '2024-03-02',
          expiresAt: '2024-04-01T00:00:00Z',
          revision: 14,
          meId: '6f1c2a9e-1c7b-4c1e-9a40-0b6f6e1f3a11',
          inviteSecret: null,
          participants: [
            {
              id: '6f1c2a9e-1c7b-4c1e-9a40-0b6f6e1f3a11',
              nickname: '서연',
              slot: 'A',
              photoCount: 128,
              aiConsent: true,
            },
            {
              id: '0d8b7c55-2e14-4f7a-8a6e-1b2c3d4e5f60',
              nickname: '도윤',
              slot: 'B',
              photoCount: 96,
              aiConsent: true,
            },
          ],
          chat: { used: 3, limit: 30, resetAt: '2024-03-20T13:00:00Z' },
          chatLastMessageId: '7c1e2f0a-9b3d-4e5f-8a6b-0c1d2e3f4a5b',
          photoLimit: 2000,
        },
      },
    },
  })
  @ApiResponse({ status: 401, ...RESPONSES.Unauthorized })
  @ApiResponse({ status: 404, ...RESPONSES.RoomNotFound })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Get(':roomId')
  getRoom(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
  ) {
    return this.rooms.getRoom(roomId, token);
  }

  @ApiOperation({
    tags: ['rooms'],
    operationId: 'updateRoom',
    summary: '처음 만난 날 바꾸기 (화면 10)',
    description:
      '두 참여자 모두 바꿀 수 있다. 바뀌면 1·2막과 3막 경계가 달라지므로 `revision`이 오른다.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: schemaRef('UpdateRoomRequest'),
          example: { metOn: '2024-03-02' },
        },
      },
    },
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiResponse({
    status: 200,
    description: '수정됨',
    content: {
      'application/json': { schema: schemaRef('UpdateRoomResponse') },
    },
  })
  @ApiResponse({ status: 400, ...RESPONSES.ValidationFailed })
  @ApiResponse({ status: 401, ...RESPONSES.Unauthorized })
  @ApiResponse({ status: 404, ...RESPONSES.RoomNotFound })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Patch(':roomId')
  updateRoom(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
    @Body() body: unknown,
  ) {
    const b = parseJsonBody('updateRoom', body);
    const issues: FieldIssue[] = [];
    const metOn = orThrow(checkMetOn(b.metOn, Date.now(), issues), issues);
    return this.rooms.updateRoom(roomId, token, metOn);
  }

  @ApiOperation({
    tags: ['rooms', 'chat'],
    operationId: 'updateMe',
    summary: 'AI 채팅 동의 켜기·철회',
    description: `두 참여자가 모두 \`aiConsent: true\`여야 \`POST /rooms/{roomId}/chat\`이 동작한다.
한 명이라도 철회하면 이후 채팅 요청은 403 \`ai_consent_required\`이다.
상대를 내보내고 새로 들어온 사람은 \`false\`로 시작한다.
`,
    requestBody: {
      required: true,
      content: { 'application/json': { schema: schemaRef('UpdateMeRequest') } },
    },
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiResponse({
    status: 200,
    description: '변경됨',
    content: { 'application/json': { schema: schemaRef('UpdateMeResponse') } },
  })
  @ApiResponse({ status: 400, ...RESPONSES.ValidationFailed })
  @ApiResponse({ status: 401, ...RESPONSES.Unauthorized })
  @ApiResponse({ status: 404, ...RESPONSES.RoomNotFound })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Patch(':roomId/participants/me')
  updateMe(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
    @Body() body: unknown,
  ) {
    const b = parseJsonBody('updateMe', body);
    return this.rooms.updateMe(roomId, token, b.aiConsent);
  }

  @ApiOperation({
    tags: ['rooms'],
    operationId: 'leaveRoom',
    summary: '방 나가기 (화면 10b)',
    description: `내 사진과 내 자리를 지운다. 남은 사람이 없으면 방도 지운다.
방의 채팅 기록도 모두 지운다(AI 답변에 나간 사람의 사진에서 나온 내용이 섞여 있다).
남은 사람이 있으면 초대 비밀값을 새로 만든다(예전 초대 링크는 403).
Nest 라우트는 \`participants/me\`를 \`participants/:participantId\`보다 먼저 선언한다.
`,
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiResponse({
    status: 200,
    description: '나감',
    content: { 'application/json': { schema: schemaRef('LeaveRoomResponse') } },
  })
  @ApiResponse({ status: 401, ...RESPONSES.Unauthorized })
  @ApiResponse({ status: 404, ...RESPONSES.RoomNotFound })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  // Declared before ':participantId' so "me" is never read as an id.
  @Delete(':roomId/participants/me')
  leaveRoom(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
  ) {
    return this.rooms.leaveRoom(roomId, token);
  }

  @ApiOperation({
    tags: ['rooms'],
    operationId: 'removePartner',
    summary: '상대 자리 비우기 (화면 10a)',
    description: `상대의 자리와 그 사진을 모두 지운다. 상대가 개인 링크(토큰)를 잃었을 때 쓰는 유일한 예외 동작이다.
방의 채팅 기록도 모두 지운다(나가기와 같은 이유).
초대 비밀값을 새로 만들어 응답에 담는다(FE는 새 초대 링크로 S2 화면을 보여준다).
자기 자신의 id면 400 \`validation_failed\`다.
`,
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiParam({
    name: 'participantId',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({
    status: 200,
    description: '비움',
    content: {
      'application/json': { schema: schemaRef('RemovePartnerResponse') },
    },
  })
  @ApiResponse({ status: 400, ...RESPONSES.ValidationFailed })
  @ApiResponse({ status: 401, ...RESPONSES.Unauthorized })
  @ApiResponse({
    status: 404,
    description:
      '방이 없거나(`room_not_found`, `room_expired`), 그 참여자가 이 방에 없다(`participant_not_found`, FE는 토큰을 지우지 않는다)',
    content: { 'application/problem+json': { schema: schemaRef('Problem') } },
  })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Delete(':roomId/participants/:participantId')
  removePartner(
    @Param('roomId') roomId: string,
    @Param('participantId') participantId: string,
    @Headers(TOKEN) token: string | undefined,
  ) {
    return this.rooms.removePartner(roomId, token, participantId);
  }
}
