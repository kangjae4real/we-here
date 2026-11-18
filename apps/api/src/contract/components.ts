import type {
  ParameterObject,
  ResponseObject,
  SchemaObject,
} from '@nestjs/swagger';

// Keeps each schema name as a literal key, so schemaRef rejects unknown names.
const table = <K extends string>(schemas: Record<K, SchemaObject>) => schemas;

export const SCHEMAS = table({
  RoomId: {
    type: 'string',
    description:
      '방 id. 128bit 랜덤 값(base64url 22자)이라 추측할 수 없다. 초대 링크와 모든 방 경로에 쓴다.',
    pattern: '^[A-Za-z0-9_-]{22}$',
    examples: ['Zk3uP1xQx0aN8sYbVb2c9w'],
  },
  Secret: {
    type: 'string',
    description:
      '초대 비밀값. 128bit 랜덤 값 (base64url 22자). 초대 링크 `#` 뒤에 붙고, 상대를 내보내면 새 값으로 바뀐다.',
    pattern: '^[A-Za-z0-9_-]{22}$',
    examples: ['8fk2-syQvT0pLx3mR9aW1b'],
  },
  Nickname: {
    type: 'string',
    description: '앞뒤 공백 제거 후 1~20자, 제어 문자 금지',
    minLength: 1,
    maxLength: 20,
    examples: ['서연'],
  },
  MetOn: {
    type: 'string',
    format: 'date',
    description: '처음 만난 날 `YYYY-MM-DD`. 1990-01-01부터 오늘(KST)까지.',
    examples: ['2024-03-02'],
  },
  LocalDateTime: {
    type: 'string',
    description: '사진이 찍힌 현지 시각 (시간대 없음, `YYYY-MM-DDTHH:mm:ss`)',
    pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$',
    examples: ['2022-04-09T15:12:00'],
  },
  Revision: {
    type: 'integer',
    minimum: 0,
    description:
      '방 내용이 바뀔 때마다 1씩 오르는 값. FE 폴링과 갱신 판단에 쓴다.',
    examples: [14],
  },
  Slot: {
    type: 'string',
    enum: ['A', 'B'],
    description: 'A는 방을 만든 사람(파란 원), B는 초대받은 사람(주황 마름모)',
  },
  ErrorCode: {
    type: 'string',
    description: `화면 분기에 쓰는 오류 코드. 기준 목록은 \`packages/contracts/src/index.ts\`에 둔다.
FE는 모르는 code를 \`status\` 기준 기본 문구로 처리한다.
`,
    enum: [
      'invalid_token',
      'room_not_found',
      'room_expired',
      'room_full',
      'invite_invalid',
      'not_owner',
      'thumb_signature_invalid',
      'thumb_signature_expired',
      'photo_not_found',
      'participant_not_found',
      'validation_failed',
      'batch_too_large',
      'room_chat_quota_exceeded',
      'global_chat_quota_exceeded',
      'rate_limited',
      'ai_consent_required',
      'chat_busy',
      'upstream_rate_limited',
      'upstream_timeout',
      'upstream_error',
      'server_misconfigured',
      'internal_error',
    ],
  },
  Problem: {
    type: 'object',
    description:
      'RFC 9457 problem details. Nest 전역 ExceptionFilter 하나가 만든다.',
    required: ['type', 'title', 'status', 'code', 'requestId'],
    properties: {
      type: {
        type: 'string',
        format: 'uri',
        description: '오류 종류 URI. `https://we-here.app/problems/{code}` 꼴이다.',
        examples: ['https://we-here.app/problems/room_expired'],
      },
      title: {
        type: 'string',
        description: '개발자용 짧은 영문 요약. 화면에 그대로 보여주지 않는다.',
        examples: ['Room expired'],
      },
      status: {
        type: 'integer',
        description: 'HTTP 상태 코드 (응답 상태와 같다)',
        examples: [404],
      },
      detail: {
        type: 'string',
        description: '개발자용 추가 설명. 있을 때만 온다.',
      },
      code: { $ref: '#/components/schemas/ErrorCode' },
      requestId: {
        type: 'string',
        description:
          '`x-request-id` 헤더와 같은 값. 5xx 화면에 앞 8자를 보여준다.',
      },
      errors: {
        type: 'array',
        description: '`validation_failed`일 때만',
        items: {
          type: 'object',
          required: ['field', 'code'],
          properties: {
            field: {
              type: 'string',
              description: '문제가 된 필드 경로',
              examples: ['nickname'],
            },
            code: {
              type: 'string',
              description: '필드 오류 종류 (`required`, `too_long`, `invalid_format`, `unknown_field` 등)',
              examples: ['too_long'],
            },
          },
        },
      },
    },
  },
  Health: {
    type: 'object',
    description: '서버 상태. DB에 닿지 못하면 이 본문 대신 503 Problem을 준다.',
    required: ['status', 'checks'],
    properties: {
      status: { type: 'string', const: 'ok', description: '항상 `ok`' },
      checks: {
        type: 'object',
        description: '의존 서비스별 확인 결과',
        properties: {
          db: { type: 'string', const: 'ok', description: 'Postgres 연결' },
        },
      },
    },
  },
  CreateRoomRequest: {
    type: 'object',
    description: '방 만들기 입력 (화면 02a). 만든 사람이 슬롯 A가 된다.',
    required: ['name', 'nickname', 'metOn'],
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        description: '방 이름 (화면 02a). 앞뒤 공백 제거 후 1~30자.',
        minLength: 1,
        maxLength: 30,
        examples: ['우리가 스친 곳'],
      },
      nickname: { $ref: '#/components/schemas/Nickname' },
      metOn: { $ref: '#/components/schemas/MetOn' },
    },
  },
  CreateRoomResponse: {
    type: 'object',
    description:
      '만든 방과 만든 사람(슬롯 A)의 인증 정보. FE는 `token`을 방별로 `localStorage`에 저장한다.',
    required: [
      'roomId',
      'participantId',
      'token',
      'inviteSecret',
      'expiresAt',
      'revision',
    ],
    properties: {
      roomId: { $ref: '#/components/schemas/RoomId' },
      participantId: {
        type: 'string',
        format: 'uuid',
        description: '내 참여자 id',
      },
      token: {
        type: 'string',
        description:
          '참여자 토큰 (256bit, base64url 43자). 이 응답에서만 받을 수 있다. 이후 요청의 `X-Participant-Token` 헤더에 넣는다. 서버는 해시만 저장한다.',
        examples: ['vJ3kQ9mX2pLr8sTn4wYc6bHd1fGa7eUz0iKo5qRtN2M'],
      },
      inviteSecret: { $ref: '#/components/schemas/Secret' },
      expiresAt: {
        type: 'string',
        format: 'date-time',
        description: '만든 시각 + 30일',
      },
      revision: { $ref: '#/components/schemas/Revision' },
    },
  },
  InvitePreview: {
    type: 'object',
    description:
      '초대 링크를 연 사람에게 보여줄 방 정보 (화면 04). 비밀값이 맞을 때만 준다.',
    required: [
      'roomId',
      'name',
      'inviterNickname',
      'metOn',
      'status',
      'vacantSlot',
    ],
    properties: {
      vacantSlot: {
        description: `들어오면 받게 될 자리. 화면 04 "너는 주황 마름모로 표시돼" 문구와 아이콘을 정한다.
A가 나간 뒤 들어오면 A(파란 원)를 받는다. 꽉 찼으면 null.
`,
        oneOf: [{ $ref: '#/components/schemas/Slot' }, { type: 'null' }],
      },
      roomId: { $ref: '#/components/schemas/RoomId' },
      name: { type: 'string', description: '방 이름 (화면 04 큰 제목)' },
      inviterNickname: {
        type: 'string',
        description: '방에 남아 있는 사람의 닉네임 ("서연이 너를 초대했어")',
      },
      metOn: { $ref: '#/components/schemas/MetOn' },
      status: {
        type: 'string',
        enum: ['open', 'full'],
        description: '`open` 자리가 남아 있어 참여할 수 있음 / `full` 두 명이 다 있음 (S7)',
      },
    },
  },
  JoinRoomRequest: {
    type: 'object',
    description: '초대 링크로 방에 들어가기 (화면 04)',
    required: ['nickname', 'inviteSecret'],
    additionalProperties: false,
    properties: {
      nickname: { $ref: '#/components/schemas/Nickname' },
      inviteSecret: { $ref: '#/components/schemas/Secret' },
    },
  },
  JoinRoomResponse: {
    type: 'object',
    description: '들어간 사람의 인증 정보와 받은 자리',
    required: ['roomId', 'participantId', 'token', 'slot', 'revision'],
    properties: {
      roomId: { $ref: '#/components/schemas/RoomId' },
      participantId: {
        type: 'string',
        format: 'uuid',
        description: '내 참여자 id',
      },
      token: {
        type: 'string',
        description:
          '참여자 토큰. 이 응답에서만 받을 수 있다. 이후 요청의 `X-Participant-Token` 헤더에 넣는다.',
        examples: ['vJ3kQ9mX2pLr8sTn4wYc6bHd1fGa7eUz0iKo5qRtN2M'],
      },
      slot: { $ref: '#/components/schemas/Slot' },
      revision: { $ref: '#/components/schemas/Revision' },
    },
  },
  Participant: {
    type: 'object',
    description: '방에 있는 사람 한 명',
    required: ['id', 'nickname', 'slot', 'photoCount', 'aiConsent'],
    properties: {
      id: { type: 'string', format: 'uuid', description: '참여자 id' },
      nickname: { $ref: '#/components/schemas/Nickname' },
      slot: { $ref: '#/components/schemas/Slot' },
      photoCount: {
        type: 'integer',
        minimum: 0,
        description: '저장된 사진 수 (기록 탭의 "128장")',
      },
      aiConsent: {
        type: 'boolean',
        description:
          'AI 채팅에 사진 기록을 쓰는 데 동의했는지. 두 사람이 모두 true여야 채팅할 수 있다 (S5).',
      },
    },
  },
  ChatQuota: {
    type: 'object',
    description: `이 방의 채팅 쿼터. 방마다 1시간 \`CHAT_ROOM_HOURLY_LIMIT\`(기본 30)회.
채팅 탭은 "이번 1시간 3/30"처럼 보여준다(Figma의 "오늘 3/20" 문구는 바꾼다). \`resetAt\`은 가장 오래된 예약이 1시간을 넘기는 시각.
`,
    required: ['used', 'limit', 'resetAt'],
    properties: {
      used: {
        type: 'integer',
        minimum: 0,
        description: '최근 1시간 동안 쓴 답변 수',
        examples: [3],
      },
      limit: {
        type: 'integer',
        description: '1시간 한도 (`CHAT_ROOM_HOURLY_LIMIT`)',
        examples: [30],
      },
      resetAt: {
        type: 'string',
        format: 'date-time',
        description: '한 칸이 다시 비는 시각. 아직 쓴 것이 없으면 지금 시각.',
      },
    },
  },
  Room: {
    type: 'object',
    description:
      '방 화면 전체가 쓰는 방 정보. FE는 이것을 폴링해 `revision`과 `chatLastMessageId`가 바뀌었는지 본다.',
    required: [
      'roomId',
      'name',
      'metOn',
      'expiresAt',
      'revision',
      'meId',
      'participants',
      'inviteSecret',
      'chat',
      'chatLastMessageId',
      'photoLimit',
    ],
    properties: {
      roomId: { $ref: '#/components/schemas/RoomId' },
      name: { type: 'string', description: '방 이름', examples: ['우리가 스친 곳'] },
      metOn: { $ref: '#/components/schemas/MetOn' },
      expiresAt: {
        type: 'string',
        format: 'date-time',
        description:
          '방이 사라지는 시각 (화면 10 "이 방은 2024.04.01에 사라져")',
      },
      revision: { $ref: '#/components/schemas/Revision' },
      meId: {
        type: 'string',
        format: 'uuid',
        description: '요청 토큰 주인의 참여자 id',
      },
      participants: {
        type: 'array',
        minItems: 1,
        maxItems: 2,
        description: '방에 있는 사람들 (1~2명)',
        items: { $ref: '#/components/schemas/Participant' },
      },
      inviteSecret: {
        description:
          '자리가 비어 있을 때만 값이 있다 (S2 "링크 다시 보내기"). 두 명이 다 있으면 null.',
        oneOf: [{ $ref: '#/components/schemas/Secret' }, { type: 'null' }],
      },
      chat: { $ref: '#/components/schemas/ChatQuota' },
      chatLastMessageId: {
        type: ['string', 'null'],
        format: 'uuid',
        description: `이 방의 마지막 채팅 메시지 id. 기록이 없으면 null.
FE는 폴링 중 이 값이 바뀌면 \`GET /rooms/{roomId}/chat/messages?after=\`로 새 메시지만 받는다.
답이 끝나도 이 값은 그대로다. 그래서 FE는 \`after\`에 \`streaming\`이 아닌 마지막 메시지 id를 넣고,
받은 목록에 \`streaming\`이 남아 있는 동안은 이 값과 상관없이 메시지를 계속 폴링한다.
`,
      },
      photoLimit: {
        type: 'integer',
        description:
          '참여자당 저장할 수 있는 사진 수 (`PHOTO_LIMIT_PER_PARTICIPANT`, 기본 2,000). FE가 고르기 전에 남은 수를 안내한다.',
      },
    },
  },
  UpdateRoomRequest: {
    type: 'object',
    description: '처음 만난 날 고치기 (화면 10). 스친 순간 계산 기준이 바뀐다.',
    required: ['metOn'],
    additionalProperties: false,
    properties: { metOn: { $ref: '#/components/schemas/MetOn' } },
  },
  UpdateRoomResponse: {
    type: 'object',
    description: '바뀐 만난 날과 새 revision',
    required: ['roomId', 'metOn', 'revision'],
    properties: {
      roomId: { $ref: '#/components/schemas/RoomId' },
      metOn: { $ref: '#/components/schemas/MetOn' },
      revision: { $ref: '#/components/schemas/Revision' },
    },
  },
  UpdateMeRequest: {
    type: 'object',
    description: '내 설정 바꾸기 (화면 09 동의 시트, 화면 10)',
    required: ['aiConsent'],
    additionalProperties: false,
    properties: {
      aiConsent: {
        type: 'boolean',
        description: 'AI 채팅에 내 사진 기록을 쓰는 데 동의하면 true, 철회하면 false',
      },
    },
  },
  UpdateMeResponse: {
    type: 'object',
    description: '바뀐 내 설정',
    required: ['participantId', 'aiConsent', 'revision'],
    properties: {
      participantId: {
        type: 'string',
        format: 'uuid',
        description: '내 참여자 id',
      },
      aiConsent: { type: 'boolean', description: '저장된 동의 값' },
      revision: { $ref: '#/components/schemas/Revision' },
    },
  },
  LeaveRoomResponse: {
    type: 'object',
    description:
      '나가기 결과. 내 사진과 이 방 채팅 기록이 지워지고 토큰은 더 쓸 수 없다.',
    required: ['deletedPhotoCount', 'roomDeleted'],
    properties: {
      deletedPhotoCount: {
        type: 'integer',
        description: '함께 지운 내 사진 수',
        examples: [128],
      },
      roomDeleted: {
        type: 'boolean',
        description: '마지막 사람이 나가서 방도 지워졌으면 true',
      },
    },
  },
  RemovePartnerResponse: {
    type: 'object',
    description:
      '상대 내보내기 결과. 상대의 사진과 채팅 기록이 지워지고, 예전 초대 링크는 막힌다.',
    required: ['deletedPhotoCount', 'inviteSecret', 'revision'],
    properties: {
      deletedPhotoCount: {
        type: 'integer',
        description: '함께 지운 상대 사진 수',
        examples: [97],
      },
      inviteSecret: {
        description: '새로 만든 초대 비밀값. 새 링크를 보낼 때 쓴다.',
        allOf: [{ $ref: '#/components/schemas/Secret' }],
      },
      revision: { $ref: '#/components/schemas/Revision' },
    },
  },
  PhotoMeta: {
    type: 'object',
    description:
      '브라우저가 exifr로 읽은 EXIF 원문. 시간 보정은 API가 이 원문으로 한다.',
    required: ['clientIndex', 'dedupeKey', 'lat', 'lng', 'dateTimeOriginal'],
    additionalProperties: false,
    properties: {
      clientIndex: {
        type: 'integer',
        minimum: 0,
        description:
          '이 배치 안의 순번. 썸네일 파트 이름 `thumb_{clientIndex}`와 맞춘다.',
      },
      dedupeKey: {
        type: 'string',
        pattern: '^[0-9a-f]{64}$',
        description:
          'SHA-256(DateTimeOriginal|SubSecTimeOriginal|위도 5자리|경도 5자리|Make|Model)',
      },
      lat: {
        type: 'number',
        minimum: -90,
        maximum: 90,
        description:
          '위도 (WGS84). (0, 0)은 위치 없음으로 보고 FE가 보내지 않는다.',
        examples: [37.5665],
      },
      lng: {
        type: 'number',
        minimum: -180,
        maximum: 180,
        description: '경도 (WGS84)',
        examples: [126.9784],
      },
      dateTimeOriginal: {
        type: 'string',
        pattern: '^\\d{4}:\\d{2}:\\d{2} \\d{2}:\\d{2}:\\d{2}$',
        description:
          'EXIF 원문. 실제 달력으로 검사하고 연도는 1990~올해+1만 받는다.',
        examples: ['2022:04:09 15:12:03'],
      },
      subSecTimeOriginal: {
        type: 'string',
        description: 'EXIF SubSecTimeOriginal (초 아래 자리). `dedupeKey`에 들어간다.',
        examples: ['123'],
      },
      offsetTimeOriginal: {
        type: 'string',
        pattern: '^[+-]\\d{2}:\\d{2}$',
        description:
          'EXIF OffsetTimeOriginal (촬영 시각의 UTC 차이). 있으면 이 값으로 시간대를 정한다.',
        examples: ['+09:00'],
      },
      gpsDateStamp: {
        type: 'string',
        description: 'EXIF GPSDateStamp (UTC 날짜). 시간대를 추정할 때 쓴다.',
        examples: ['2022:04:09'],
      },
      gpsTimeStamp: {
        type: 'string',
        description: 'EXIF GPSTimeStamp (UTC 시각)',
        examples: ['06:12:03'],
      },
      make: {
        type: 'string',
        description: '카메라 제조사 (EXIF Make). `dedupeKey`에 들어간다.',
        examples: ['Apple'],
      },
      model: {
        type: 'string',
        description: '카메라 모델 (EXIF Model). `dedupeKey`에 들어간다.',
        examples: ['iPhone 15 Pro'],
      },
    },
  },
  PhotoErrorCode: {
    type: 'string',
    description: `사진 한 장이 저장되지 않은 이유. 배치 안의 다른 사진은 그대로 저장된다.
\`invalid_lat\`·\`invalid_lng\` 좌표 범위 밖 또는 (0, 0) / \`invalid_datetime\` 촬영 시각 형식·범위 오류 /
\`invalid_dedupe_key\` 해시 형식 오류 / \`thumb_too_large\` 썸네일이 너무 큼 / \`thumb_not_jpeg\` 썸네일이 JPEG가 아님 /
\`photo_limit_reached\` 참여자당 사진 한도(\`photoLimit\`) 초과
`,
    enum: [
      'invalid_lat',
      'invalid_lng',
      'invalid_datetime',
      'invalid_dedupe_key',
      'thumb_too_large',
      'thumb_not_jpeg',
      'photo_limit_reached',
    ],
  },
  UploadResult: {
    type: 'object',
    description: '보낸 사진 한 장의 처리 결과. 요청의 `clientIndex`로 맞춘다.',
    required: ['clientIndex', 'dedupeKey', 'status'],
    properties: {
      clientIndex: {
        type: 'integer',
        description: '요청에서 보낸 순번 그대로',
        examples: [0],
      },
      dedupeKey: { type: 'string', description: '요청에서 보낸 값 그대로' },
      status: {
        type: 'string',
        enum: ['saved', 'duplicate', 'error'],
        description:
          '`duplicate`는 이미 저장된 사진이라 FE가 저장된 점으로 그린다.',
      },
      photoId: {
        type: 'string',
        format: 'uuid',
        description: '`saved`, `duplicate`일 때',
      },
      error: {
        type: 'object',
        description: '`error`일 때만',
        required: ['code'],
        properties: {
          code: { $ref: '#/components/schemas/PhotoErrorCode' },
          field: {
            type: 'string',
            description: '문제가 된 필드 이름',
            examples: ['lat'],
          },
        },
      },
    },
  },
  UploadPhotosResponse: {
    type: 'object',
    description:
      '배치 업로드 결과. 한 장이라도 저장되면 `revision`이 1 오르고, 모두 중복·오류면 그대로다.',
    required: ['revision', 'results'],
    properties: {
      revision: { $ref: '#/components/schemas/Revision' },
      results: {
        type: 'array',
        description: '보낸 사진마다 하나씩, 보낸 순서대로',
        items: { $ref: '#/components/schemas/UploadResult' },
      },
    },
  },
  DeletePhotosResponse: {
    type: 'object',
    description: '사진 삭제 결과',
    required: ['deletedCount', 'revision'],
    properties: {
      deletedCount: {
        type: 'integer',
        description: '지운 사진 수. 0이면 `revision`도 그대로다.',
        examples: [1],
      },
      revision: { $ref: '#/components/schemas/Revision' },
    },
  },
  Photo: {
    type: 'object',
    description: '서버에 저장된 사진 한 장 (지도 점 하나). 원본 사진은 없고 메타데이터와 썸네일만 있다.',
    required: [
      'id',
      'participantId',
      'dedupeKey',
      'lat',
      'lng',
      'takenLocal',
      'takenUtc',
      'tzOffsetMin',
      'timeSource',
      'uncertain',
      'placeLabel',
      'thumbUrl',
      'uploadedAt',
    ],
    properties: {
      uploadedAt: {
        type: 'string',
        format: 'date-time',
        description:
          '서버에 저장된 시각. 화면 05(데스크톱) "최근 올린 사진"과 갱신 토스트 "도윤이 사진 N장을 올렸어"에 쓴다.',
      },
      id: { type: 'string', format: 'uuid', description: '사진 id' },
      participantId: {
        type: 'string',
        format: 'uuid',
        description: '올린 사람. `participants`에서 슬롯(점 모양과 색)을 찾는다.',
      },
      dedupeKey: {
        type: 'string',
        description:
          '업로드 중 흐린 점과 서버 사진을 `(participantId, dedupeKey)`로 맞출 때 쓴다.',
      },
      lat: {
        type: 'number',
        description: '위도. 소수 4자리(약 11m)로 반올림된 값',
        examples: [37.5665],
      },
      lng: {
        type: 'number',
        description: '경도. 소수 4자리로 반올림된 값',
        examples: [126.9784],
      },
      takenLocal: { $ref: '#/components/schemas/LocalDateTime' },
      takenUtc: {
        type: 'string',
        format: 'date-time',
        description: '`takenLocal`을 `tzOffsetMin`으로 UTC로 바꾼 값. 두 사람 사진을 비교할 때 쓴다.',
        examples: ['2022-04-09T06:12:00Z'],
      },
      tzOffsetMin: {
        type: 'integer',
        description: '현지 시각 − UTC (분). KST는 540.',
      },
      timeSource: {
        type: 'string',
        enum: ['offset', 'kr_bounds', 'gps', 'assumed_kst'],
        description: `시간대를 정한 근거. \`offset\` EXIF OffsetTimeOriginal, \`kr_bounds\` 한국 좌표라 KST,
\`gps\` GPS 시각과의 차이, \`assumed_kst\` 근거 없이 KST로 가정.
`,
      },
      uncertain: {
        type: 'boolean',
        description: '시각이 가정이거나 GPS와 5분 넘게 어긋남',
      },
      placeLabel: {
        type: ['string', 'null'],
        description: '역지오코딩한 동네 이름. 실패하면 null, 해외면 "해외".',
      },
      thumbUrl: {
        type: ['string', 'null'],
        description:
          '`/thumbs/{photoId}?exp=&sig=` 상대 경로. 썸네일이 없으면 null.',
      },
    },
  },
  MomentSide: {
    type: 'object',
    description: '스친 순간·1막 카드의 한쪽 사진 (폴라로이드 하나)',
    required: ['participantId', 'photoId', 'takenLocal'],
    properties: {
      participantId: {
        type: 'string',
        format: 'uuid',
        description: '사진을 올린 참여자 id',
      },
      photoId: {
        type: 'string',
        format: 'uuid',
        description: '`photos`의 사진 id. 썸네일은 거기서 찾는다.',
      },
      takenLocal: { $ref: '#/components/schemas/LocalDateTime' },
    },
  },
  Encounter: {
    type: 'object',
    description:
      '스친 순간 카드 (화면 07c). `a`는 슬롯 A, `b`는 슬롯 B의 사진이다.',
    required: [
      'id',
      'a',
      'b',
      'distanceM',
      'gapMin',
      'center',
      'placeLabel',
      'uncertain',
    ],
    properties: {
      id: {
        type: 'string',
        pattern: '^E-[a-z0-9]{6}$',
        description:
          '대표 사진 쌍으로 만든 안정적인 id. 채팅 근거 칩이 이 id로 카드를 연다.',
      },
      a: { $ref: '#/components/schemas/MomentSide' },
      b: { $ref: '#/components/schemas/MomentSide' },
      distanceM: { type: 'integer', description: '두 사진 사이 거리 (m)' },
      gapMin: { type: 'integer', description: '두 사진의 촬영 시각 차이 (분)' },
      center: {
        description: '두 사진의 중간 지점. 지도에서 카드를 이 위치에 띄운다.',
        allOf: [{ $ref: '#/components/schemas/LatLng' }],
      },
      placeLabel: {
        type: ['string', 'null'],
        description: '중간 지점의 동네 이름. 실패하면 null.',
        examples: ['성수동'],
      },
      uncertain: {
        type: 'boolean',
        description: '두 사진 중 하나라도 시각이 불확실하면(`Photo.uncertain`) true',
      },
    },
  },
  ClosestMoment: {
    type: 'object',
    description:
      '스친 순간이 0개일 때 보여줄 "가장 가까웠던 순간" (최대 3개, 스친 순간과 다른 모양으로 표시)',
    required: ['id', 'a', 'b', 'distanceM', 'gapMin', 'placeLabel'],
    properties: {
      id: {
        type: 'string',
        pattern: '^C-[a-z0-9]{6}$',
        description: '사진 쌍으로 만든 안정적인 id',
      },
      a: { $ref: '#/components/schemas/MomentSide' },
      b: { $ref: '#/components/schemas/MomentSide' },
      distanceM: {
        type: 'integer',
        description: '두 사진 사이 거리 (m)',
        examples: [1840],
      },
      gapMin: {
        type: 'integer',
        description: '두 사진의 촬영 시각 차이 (분). 24시간 안의 쌍만 고른다.',
        examples: [95],
      },
      placeLabel: {
        type: ['string', 'null'],
        description: '중간 지점의 동네 이름. 실패하면 null.',
      },
    },
  },
  LatLng: {
    type: 'object',
    description: '지도 좌표 (WGS84)',
    required: ['lat', 'lng'],
    properties: {
      lat: { type: 'number', description: '위도', examples: [37.5446] },
      lng: { type: 'number', description: '경도', examples: [127.0559] },
    },
  },
  HeatCell: {
    type: 'object',
    description:
      '히트맵 칸 하나 (화면 08). 처음 만난 날 이후 사진만 센다. 칸은 geohash 7자리(약 150m 사각형)다.',
    required: ['cellId', 'lat', 'lng', 'days', 'weight', 'placeLabel'],
    properties: {
      cellId: {
        type: 'string',
        pattern: '^P-[a-z0-9]+$',
        description: '`P-` + geohash 7자리. 채팅 근거 칩이 이 id로 장소를 연다.',
        examples: ['P-wydm9qy'],
      },
      lat: { type: 'number', description: '칸 중심 위도' },
      lng: { type: 'number', description: '칸 중심 경도' },
      days: {
        type: 'integer',
        description:
          '만난 후 둘 중 누구라도 이 칸에 사진을 남긴 서로 다른 날 수',
      },
      weight: {
        type: 'number',
        minimum: 0.1,
        maximum: 1,
        description:
          '네이버 HeatMap용으로 정규화한 값. 가장 많은 칸의 `days`로 나누고 0.1 아래는 0.1로 올린다.',
      },
      placeLabel: {
        type: ['string', 'null'],
        description: '칸 중심의 동네 이름. 실패하면 null.',
      },
    },
  },
  TopPlace: {
    type: 'object',
    description: '자주 간 장소 순위 한 줄 (화면 08 "자주 간 곳")',
    required: ['rank', 'cellId', 'placeLabel', 'days'],
    properties: {
      rank: { type: 'integer', minimum: 1, description: '1부터 시작하는 순위' },
      cellId: {
        type: 'string',
        description: '`heatmap.cells`의 칸 id',
        examples: ['P-wydm9qy'],
      },
      placeLabel: {
        type: ['string', 'null'],
        description: '동네 이름. 실패하면 null.',
        examples: ['성수동'],
      },
      days: {
        type: 'integer',
        description: '둘 중 누구라도 이 칸에 사진을 남긴 서로 다른 날 수',
        examples: [12],
      },
    },
  },
  Act1Item: {
    type: 'object',
    description:
      '1막 "같은 곳, 다른 때" 카드 한 장. 만나기 전, 150m 안에서 시각만 달랐던 두 사진이다. 스친 순간이 있는 칸은 뺀다.',
    required: ['cellId', 'placeLabel', 'a', 'b', 'sameDay', 'gapMin'],
    properties: {
      cellId: {
        type: 'string',
        description: '두 사진 중간 지점의 칸 id (`P-…`)',
      },
      placeLabel: {
        type: ['string', 'null'],
        description: '동네 이름. 실패하면 null.',
      },
      a: { $ref: '#/components/schemas/MomentSide' },
      b: { $ref: '#/components/schemas/MomentSide' },
      sameDay: {
        type: 'boolean',
        description: '같은 날 엇갈렸으면 true ("같은 날, 3시간 차이")',
      },
      gapMin: {
        type: 'integer',
        description: '두 사진의 촬영 시각 차이 (분)',
        examples: [180],
      },
    },
  },
  Story: {
    type: 'object',
    description: '리플레이 챕터 목록 (화면 07의 ①7곳 ②2번 ③2024.03.02부터)',
    required: ['act1', 'act2', 'act3'],
    properties: {
      act1: {
        type: 'object',
        description: '1막: 같은 곳, 다른 때 (만나기 전)',
        required: ['total', 'items'],
        properties: {
          total: {
            type: 'integer',
            description: '조건에 맞는 칸 전체 수 (화면 "7곳")',
          },
          items: {
            type: 'array',
            maxItems: 10,
            description: '시각 차이가 작은 순으로 최대 10장',
            items: { $ref: '#/components/schemas/Act1Item' },
          },
        },
      },
      act2: {
        type: 'object',
        description: '2막: 스친 순간 (만나기 전)',
        required: ['encounterIds'],
        properties: {
          encounterIds: {
            type: 'array',
            description: '`encounters`의 id. 시간순. 개수가 화면의 "2번"이다.',
            items: { type: 'string', examples: ['E-k3x9a2'] },
          },
        },
      },
      act3: {
        type: 'object',
        description: '3막: 만난 뒤 함께한 기록',
        required: ['from', 'placeCount', 'dayCount'],
        properties: {
          from: { $ref: '#/components/schemas/MetOn' },
          placeCount: {
            type: 'integer',
            description: '만난 뒤 사진을 남긴 칸 수',
            examples: [23],
          },
          dayCount: {
            type: 'integer',
            description: '만난 뒤 사진을 남긴 서로 다른 날 수',
            examples: [41],
          },
        },
      },
    },
  },
  RecordStats: {
    type: 'object',
    description: '기록 탭 요약 세 줄 (화면 05)',
    required: ['oldest', 'newest', 'afterMetPlaceCount'],
    properties: {
      oldest: {
        description: '두 사람 사진 중 가장 오래된 것. 사진이 없으면 null.',
        oneOf: [{ $ref: '#/components/schemas/PhotoBrief' }, { type: 'null' }],
      },
      newest: {
        description: '두 사람 사진 중 가장 최근 것. 사진이 없으면 null.',
        oneOf: [{ $ref: '#/components/schemas/PhotoBrief' }, { type: 'null' }],
      },
      afterMetPlaceCount: {
        type: 'integer',
        description: '만난 뒤 사진을 남긴 칸 수 (화면 "함께 간 장소 23곳")',
      },
    },
  },
  PhotoBrief: {
    type: 'object',
    description: '요약 한 줄에 쓰는 사진 시각과 장소',
    required: ['takenLocal', 'placeLabel'],
    properties: {
      takenLocal: { $ref: '#/components/schemas/LocalDateTime' },
      placeLabel: {
        type: ['string', 'null'],
        description: '동네 이름. 실패하면 null.',
        examples: ['연남동'],
      },
    },
  },
  Snapshot: {
    type: 'object',
    description:
      '방 화면이 그리는 모든 데이터 (기록·리플레이·스친 순간·히트맵). 서버가 사진 전체로 계산하고 `revision`이 바뀌면 다시 받는다.',
    required: [
      'revision',
      'criteria',
      'stats',
      'photos',
      'encounters',
      'closest',
      'heatmap',
      'story',
    ],
    properties: {
      revision: { $ref: '#/components/schemas/Revision' },
      criteria: {
        type: 'object',
        description: '스친 순간 기준값. 카드의 기준 문구가 이 값을 읽는다.',
        required: ['radiusM', 'windowMin', 'mergeGapMin'],
        properties: {
          radiusM: {
            type: 'integer',
            description: '두 사진 거리가 이 값(m) 이하여야 스친 순간',
            examples: [250],
          },
          windowMin: {
            type: 'integer',
            description: '두 사진 시각 차이가 이 값(분) 이하여야 스친 순간',
            examples: [10],
          },
          mergeGapMin: {
            type: 'integer',
            description: '이 값(분) 안에 이어진 후보는 한 번으로 합친다',
            examples: [30],
          },
        },
      },
      stats: { $ref: '#/components/schemas/RecordStats' },
      photos: {
        type: 'array',
        description: '두 사람의 사진 전체',
        items: { $ref: '#/components/schemas/Photo' },
      },
      encounters: {
        type: 'array',
        description:
          '스친 순간 (만나기 전, `criteria` 안에서 두 사람이 가까이 있었던 때). 시간순.',
        items: { $ref: '#/components/schemas/Encounter' },
      },
      closest: {
        type: 'array',
        maxItems: 3,
        description: '스친 순간이 0개일 때만 채운다 (S4)',
        items: { $ref: '#/components/schemas/ClosestMoment' },
      },
      heatmap: {
        type: 'object',
        description: '만난 뒤 함께한 장소 히트맵 (화면 08)',
        required: ['cells', 'top'],
        properties: {
          cells: {
            type: 'array',
            description: '사진이 있는 칸 전부. 날 수가 많은 순.',
            items: { $ref: '#/components/schemas/HeatCell' },
          },
          top: {
            type: 'array',
            maxItems: 10,
            description: '날 수가 많은 순. 화면 08은 앞 3개를 쓴다.',
            items: { $ref: '#/components/schemas/TopPlace' },
          },
        },
      },
      story: { $ref: '#/components/schemas/Story' },
    },
  },
  ChatMessage: {
    type: 'object',
    description: '방에 저장된 채팅 메시지 하나',
    required: [
      'id',
      'role',
      'authorId',
      'content',
      'evidenceIds',
      'status',
      'createdAt',
    ],
    properties: {
      id: { type: 'string', format: 'uuid', description: '메시지 id' },
      role: {
        type: 'string',
        enum: ['user', 'assistant'],
        description: '`user` 참여자의 질문 / `assistant` AI 답변',
      },
      authorId: {
        type: ['string', 'null'],
        format: 'uuid',
        description:
          '질문한 참여자 id. `assistant`면 null. FE는 `meId`와 비교해 "나 / 상대" 말풍선을 고른다.',
      },
      content: {
        type: 'string',
        description:
          '`user`는 1~1,000자. `assistant`는 `streaming`·`failed`일 때 비어 있을 수 있다.',
      },
      evidenceIds: {
        type: 'array',
        description:
          '근거 칩으로 바꿔도 되는 id (`E-…`, `P-…`). `user`면 빈 배열.',
        items: { type: 'string' },
      },
      status: {
        type: 'string',
        enum: ['streaming', 'complete', 'truncated', 'failed'],
        description: `\`streaming\` 답하는 중 / \`complete\` 끝 / \`truncated\` 길이 제한으로 잘림("답변이 길어서 잘렸어") /
\`failed\` 제공자 오류로 중단("답을 못 가져왔어" + 다시 묻기). \`user\`는 항상 \`complete\`.
`,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: '메시지가 저장된 시각',
      },
    },
  },
  ChatHistory: {
    type: 'object',
    description: '방의 채팅 기록 한 페이지',
    required: ['messages', 'hasMore'],
    properties: {
      messages: {
        type: 'array',
        description: '오래된 순',
        items: { $ref: '#/components/schemas/ChatMessage' },
      },
      hasMore: {
        type: 'boolean',
        description:
          '`before` 방향(또는 파라미터 없음)이면 더 오래된 메시지가 있는지, `after` 방향이면 더 새 메시지가 있는지',
      },
    },
  },
  ChatRequest: {
    type: 'object',
    required: ['content'],
    additionalProperties: false,
    description:
      '질문 하나만 보낸다. 모델 선택 필드와 지난 대화 필드는 없다(서버가 정하고 서버가 꺼낸다).',
    properties: {
      content: {
        type: 'string',
        minLength: 1,
        maxLength: 1000,
        description: '앞뒤 공백을 지운 뒤 길이를 잰다.',
      },
    },
  },
  ChatFrame: {
    description: 'NDJSON 스트림의 한 줄',
    oneOf: [
      {
        type: 'object',
        title: 'meta',
        description:
          '첫 줄. 저장된 질문·답변 id, 근거 칩 id, 갱신된 쿼터를 준다.',
        required: [
          'type',
          'revision',
          'userMessageId',
          'assistantMessageId',
          'evidenceIds',
          'quota',
        ],
        properties: {
          type: { const: 'meta' },
          revision: { $ref: '#/components/schemas/Revision' },
          userMessageId: {
            type: 'string',
            format: 'uuid',
            description: '저장된 내 질문 메시지 id',
          },
          assistantMessageId: {
            type: 'string',
            format: 'uuid',
            description: '저장 중인 답변 메시지 id (`streaming` 상태)',
          },
          evidenceIds: {
            type: 'array',
            description:
              '답변 속 근거 칩으로 바꿔도 되는 id (`E-…` 스친 순간, `P-…` 장소)',
            items: { type: 'string' },
          },
          quota: { $ref: '#/components/schemas/ChatQuota' },
        },
      },
      {
        type: 'object',
        title: 'text',
        required: ['type', 'delta'],
        description: '답변 조각. `delta`를 차례로 이어 붙인다.',
        properties: {
          type: { const: 'text' },
          delta: {
            type: 'string',
            description: '이어 붙일 답변 텍스트',
            examples: ['2022년 4월 9일에 '],
          },
        },
      },
      {
        type: 'object',
        title: 'done',
        description: '마지막 줄. 답변이 끝났다.',
        required: ['type', 'finishReason'],
        properties: {
          type: { const: 'done' },
          finishReason: {
            type: 'string',
            enum: ['stop', 'length'],
            description: '`length`면 FE가 "답변이 길어서 잘렸어"를 붙인다.',
          },
        },
      },
      {
        type: 'object',
        title: 'error',
        description:
          '스트림 중간에 실패했다. 이것이 마지막 줄이고 답변은 `failed`로 저장된다.',
        required: ['type', 'code', 'requestId'],
        properties: {
          type: { const: 'error' },
          code: { $ref: '#/components/schemas/ErrorCode' },
          requestId: {
            type: 'string',
            description: '`x-request-id`와 같은 값',
          },
        },
      },
    ],
  },
});

export type SchemaName = keyof typeof SCHEMAS;

export const schemaRef = (name: SchemaName) => ({
  $ref: `#/components/schemas/${name}`,
});

export const PARAMETERS = {
  RoomId: {
    name: 'roomId',
    in: 'path',
    required: true,
    description: '방 id. 128bit 랜덤 값 (base64url 22자)',
    schema: schemaRef('RoomId'),
  },
  PhotoId: {
    name: 'photoId',
    in: 'path',
    required: true,
    description: '사진 id (`Photo.id`)',
    schema: { type: 'string', format: 'uuid' },
  },
} satisfies Record<string, ParameterObject>;

export const RESPONSES = {
  Unauthorized: {
    description:
      '토큰이 없거나 이 방의 참여자와 맞지 않는다 (`invalid_token`). 나가기·내보내기 뒤의 토큰도 여기에 해당한다.',
    content: {
      'application/problem+json': {
        schema: schemaRef('Problem'),
        example: {
          type: 'https://we-here.app/problems/invalid_token',
          title: 'Invalid participant token',
          status: 401,
          code: 'invalid_token',
          requestId: '7c0e2b1d-5a8f-4e7a-9b1d-2f6c3e8a9d10',
        },
      },
    },
  },
  RoomNotFound: {
    description:
      '방이 없거나(`room_not_found`) 30일이 지나 지워졌다(`room_expired`, S8)',
    content: {
      'application/problem+json': {
        schema: schemaRef('Problem'),
        example: {
          type: 'https://we-here.app/problems/room_expired',
          title: 'Room expired',
          status: 404,
          code: 'room_expired',
          requestId: '7c0e2b1d-5a8f-4e7a-9b1d-2f6c3e8a9d10',
        },
      },
    },
  },
  InviteInvalid: {
    description:
      '초대 비밀값이 틀렸거나, 자리가 비워진 뒤의 예전 링크다 (`invite_invalid`)',
    content: { 'application/problem+json': { schema: schemaRef('Problem') } },
  },
  ValidationFailed: {
    description:
      '입력 검증 실패 (`validation_failed`). 입력값은 되돌려 보내지 않는다.',
    content: {
      'application/problem+json': {
        schema: schemaRef('Problem'),
        example: {
          type: 'https://we-here.app/problems/validation_failed',
          title: 'Validation failed',
          status: 400,
          code: 'validation_failed',
          requestId: '7c0e2b1d-5a8f-4e7a-9b1d-2f6c3e8a9d10',
          errors: [{ field: 'nickname', code: 'too_long' }],
        },
      },
    },
  },
  ServerError: {
    description: `예상하지 못한 서버 오류(500 \`internal_error\`), 또는 필수 env가 빠진 설정 오류(503 \`server_misconfigured\`).
FE는 "오류 ID {requestId 앞 8자}"를 작게 보여주고 다시 시도를 띄운다.
`,
    content: { 'application/problem+json': { schema: schemaRef('Problem') } },
  },
  RateLimited: {
    description: 'IP당 요청 한도 초과 (`rate_limited`)',
    headers: { 'Retry-After': { schema: { type: 'integer' } } },
    content: { 'application/problem+json': { schema: schemaRef('Problem') } },
  },
} satisfies Record<string, ResponseObject>;
