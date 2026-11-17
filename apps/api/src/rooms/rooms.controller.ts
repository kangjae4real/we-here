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
import { CONFIG, type Config } from '../config.js';
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

  @Get(':roomId')
  getRoom(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
  ) {
    return this.rooms.getRoom(roomId, token);
  }

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

  @Patch(':roomId/participants/me')
  updateMe(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
    @Body() body: unknown,
  ) {
    const b = parseJsonBody('updateMe', body);
    return this.rooms.updateMe(roomId, token, b.aiConsent);
  }

  // Declared before ':participantId' so "me" is never read as an id.
  @Delete(':roomId/participants/me')
  leaveRoom(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
  ) {
    return this.rooms.leaveRoom(roomId, token);
  }

  @Delete(':roomId/participants/:participantId')
  removePartner(
    @Param('roomId') roomId: string,
    @Param('participantId') participantId: string,
    @Headers(TOKEN) token: string | undefined,
  ) {
    return this.rooms.removePartner(roomId, token, participantId);
  }
}
