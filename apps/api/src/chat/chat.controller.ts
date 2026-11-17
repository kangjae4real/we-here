import { Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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

  @Get(':roomId/chat/messages')
  listChatMessages(
    @Param('roomId') roomId: string,
    @Headers(TOKEN) token: string | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    return this.chats.list(roomId, token, parseHistoryQuery(query));
  }

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
