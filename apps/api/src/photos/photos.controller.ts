import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PARAMETERS, RESPONSES, schemaRef } from '../contract/components.js';
import { PhotosService } from './photos.service.js';
import { readUpload } from './upload-input.js';

const TOKEN = 'x-participant-token';

@Controller()
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @ApiOperation({
    tags: ['photos'],
    operationId: 'uploadPhotos',
    summary: '사진 메타데이터·썸네일 배치 업로드 (화면 06b)',
    description: `브라우저가 EXIF에서 읽은 값과 긴 변 320px JPEG 썸네일만 보낸다. 원본 사진은 오지 않는다.
FE는 좌표와 \`DateTimeOriginal\`이 둘 다 있는 사진만 보내고, 요청 하나를 **50장 또는 2MB** 중 먼저 닿는 쪽으로 자른다.

**multipart 구성**
- part \`meta\`: \`PhotoMeta\` JSON 배열
- part \`thumb_{clientIndex}\`: 해당 사진의 JPEG 썸네일(40KB 이하). 썸네일이 없으면 생략한다.

**저장 규칙**
- \`(participantId, dedupeKey)\`가 이미 있으면 덮어쓰지 않고 \`duplicate\`다.
  단, 기존 썸네일이 없거나 새 썸네일보다 작으면 썸네일만 채운다.
- 사진 하나가 잘못되면 그 사진만 \`error\`이고 나머지는 저장된다.
- 참여자당 \`PHOTO_LIMIT_PER_PARTICIPANT\`(기본 2,000)를 넘는 사진은 \`photo_limit_reached\`다.
- 좌표는 소수 4자리(약 11m)로 반올림해 저장한다.
- 하나라도 저장되면 \`revision\`이 1 오르고, 전부 \`duplicate\`면 그대로다.
`,
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: ['meta'],
            properties: {
              meta: {
                type: 'array',
                minItems: 1,
                maxItems: 50,
                items: schemaRef('PhotoMeta'),
              },
            },
            additionalProperties: {
              description: '`thumb_{clientIndex}` 이름의 JPEG 파일 파트',
              type: 'string',
              contentMediaType: 'image/jpeg',
            },
          },
          encoding: { meta: { contentType: 'application/json' } },
        },
      },
    },
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiResponse({
    status: 200,
    description: '사진별 결과 (요청 `meta` 순서와 같다)',
    content: {
      'application/json': {
        schema: schemaRef('UploadPhotosResponse'),
        example: {
          revision: 15,
          results: [
            {
              clientIndex: 0,
              dedupeKey:
                '3f2a6c0e9b1d4a7f8e2c5b9a0d1f3e6c7b8a9d0e1f2a3b4c5d6e7f8091a2b3c4',
              status: 'saved',
              photoId: '9b2f4c1a-7d3e-4f80-a1b2-c3d4e5f60718',
            },
            {
              clientIndex: 1,
              dedupeKey:
                '0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9',
              status: 'duplicate',
              photoId: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
            },
            {
              clientIndex: 2,
              dedupeKey:
                'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100',
              status: 'error',
              error: { code: 'invalid_datetime', field: 'dateTimeOriginal' },
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 400, ...RESPONSES.ValidationFailed })
  @ApiResponse({ status: 401, ...RESPONSES.Unauthorized })
  @ApiResponse({ status: 404, ...RESPONSES.RoomNotFound })
  @ApiResponse({
    status: 413,
    description:
      '50장 또는 2MB를 넘었다. FE는 영구 실패로 표시하고 다시 시도 버튼을 띄우지 않는다.',
    content: {
      'application/problem+json': {
        schema: schemaRef('Problem'),
        example: {
          type: 'https://we-here.app/problems/batch_too_large',
          title: 'Batch too large',
          status: 413,
          code: 'batch_too_large',
          requestId: '7c0e2b1d-5a8f-4e7a-9b1d-2f6c3e8a9d10',
        },
      },
    },
  })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Post('rooms/:roomId/photos')
  @HttpCode(200)
  async uploadPhotos(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const verdicts = await readUpload(req, res, Date.now());
    return this.photos.uploadPhotos(roomId, token, verdicts);
  }

  @ApiOperation({
    tags: ['photos'],
    operationId: 'deleteMyPhotos',
    summary: '내 사진 전체 삭제',
    description: `요청한 참여자가 올린 사진과 썸네일을 모두 지운다. 상대 사진은 그대로다.
한 장이라도 지우면 \`revision\`이 1 오르고, 지울 것이 없으면 \`deletedCount: 0\`과 그대로인 \`revision\`을 준다.
`,
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiResponse({
    status: 200,
    description: '삭제됨',
    content: {
      'application/json': { schema: schemaRef('DeletePhotosResponse') },
    },
  })
  @ApiResponse({ status: 401, ...RESPONSES.Unauthorized })
  @ApiResponse({ status: 404, ...RESPONSES.RoomNotFound })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Delete('rooms/:roomId/participants/me/photos')
  deleteMyPhotos(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
  ) {
    return this.photos.deleteMyPhotos(roomId, token);
  }

  @ApiOperation({
    tags: ['photos'],
    operationId: 'deletePhoto',
    summary: '내 사진 한 장 삭제',
    description: `내가 올린 사진 한 장과 썸네일을 지운다. 상대 사진이면 403 \`not_owner\`다.
지우면 \`revision\`이 1 오른다.
`,
  })
  @ApiParam(PARAMETERS.RoomId)
  @ApiParam(PARAMETERS.PhotoId)
  @ApiResponse({
    status: 200,
    description: '삭제됨',
    content: {
      'application/json': { schema: schemaRef('DeletePhotosResponse') },
    },
  })
  @ApiResponse({ status: 401, ...RESPONSES.Unauthorized })
  @ApiResponse({
    status: 403,
    description: '상대의 사진이다 (`not_owner`)',
    content: { 'application/problem+json': { schema: schemaRef('Problem') } },
  })
  @ApiResponse({
    status: 404,
    description:
      '방이 없거나, 이 방에 그 사진이 없다 (`room_not_found`, `photo_not_found`)',
    content: { 'application/problem+json': { schema: schemaRef('Problem') } },
  })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Delete('rooms/:roomId/photos/:photoId')
  deletePhoto(
    @Param('roomId') roomId: string,
    @Param('photoId') photoId: string,
    @Headers(TOKEN) token: string | undefined,
  ) {
    return this.photos.deletePhoto(roomId, token, photoId);
  }

  @ApiOperation({
    tags: ['photos'],
    operationId: 'getThumbnail',
    summary: '썸네일 이미지 (서명 URL)',
    description: `\`<img>\`는 헤더를 보낼 수 없어서 토큰 대신 서명으로 인증한다.
\`sig = HMAC-SHA256(THUMB_SIGNING_SECRET, photoId + "." + exp)\`(hex), 유효 기간 최대 24시간이며 방의 \`expiresAt\`을 넘지 않는다.
스냅샷의 \`thumbUrl\`이 이 경로를 상대 경로로 담고, FE가 앞에 \`/api/v1\`을 붙인다.
로드에 실패하면 FE는 스냅샷을 한 번 다시 받아 URL을 바꾼다.
`,
    security: [],
  })
  @ApiParam(PARAMETERS.PhotoId)
  @ApiQuery({
    name: 'exp',
    required: true,
    description: '만료 시각 (Unix 초, 1시간 단위로 올림)',
    schema: { type: 'integer' },
  })
  @ApiQuery({
    name: 'sig',
    required: true,
    schema: { type: 'string', pattern: '^[0-9a-f]{64}$' },
  })
  @ApiResponse({
    status: 200,
    description: 'JPEG 썸네일',
    headers: {
      'Cache-Control': {
        schema: { type: 'string', const: 'private, max-age=86400' },
      },
    },
    content: {
      'image/jpeg': {
        schema: { type: 'string', contentMediaType: 'image/jpeg' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description:
      '서명이 틀렸거나 만료됐다 (`thumb_signature_invalid`, `thumb_signature_expired`)',
    content: { 'application/problem+json': { schema: schemaRef('Problem') } },
  })
  @ApiResponse({
    status: 404,
    description:
      '사진이 지워졌거나 방이 만료됐다 (`photo_not_found`, `room_expired`)',
    content: { 'application/problem+json': { schema: schemaRef('Problem') } },
  })
  @ApiResponse({ status: 'default', ...RESPONSES.ServerError })
  @Get('thumbs/:photoId')
  async getThumbnail(
    @Param('photoId') photoId: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() res: Response,
  ) {
    const jpeg = await this.photos.getThumbnail(photoId, exp, sig);
    res
      .status(200)
      .type('image/jpeg')
      .setHeader('Cache-Control', 'private, max-age=86400')
      .send(jpeg);
  }
}
