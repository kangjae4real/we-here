import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONFIG, type Config } from '../config.js';
import type { W } from '../contract/index.js';
import {
  buildPrompt,
  citedEvidence,
  evidenceIdsOf,
  fitHistory,
  type HistoryQuery,
  type HistoryTurn,
  type MessageStatus,
  toChatSummary,
} from '../core/chat.js';
import { asRoomId, type LocalDate, type MessageId } from '../core/domain.js';
import { InvalidInput } from '../core/input.js';
import type { RoomPhoto } from '../core/snapshot.js';
import { kstDate, nextKstMidnightMs } from '../core/time.js';
import { Db, type Sql } from '../db/db.js';
import { ApiError } from '../http/problem.js';
import { RoomAccess, unchanged } from '../rooms/room-access.js';
import { readRoomQuota } from '../rooms/rooms.service.js';
import { readRoomPhotos, SnapshotService } from '../snapshot/snapshot.service.js';
import { LLM_ADAPTERS, LlmError, type LlmEvent, type LlmProvider, withDeadlines } from './llm.js';

type ChatFrame = W<'ChatFrame'>;

export interface FrameSink {
  start(): void;
  write(frame: ChatFrame): void;
  end(): void;
  readonly requestId: string;
}

interface Turn {
  revision: number;
  userMessageId: MessageId;
  assistantMessageId: MessageId;
  quota: W<'ChatQuota'>;
  nicknames: string[];
  metOn: LocalDate;
  photos: RoomPhoto[];
  history: HistoryTurn[];
}

const MAX_TOKENS = 800;
const SAVE_EVERY_MS = 500;

interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  authorId: string | null;
  content: string;
  evidenceIds: string[];
  status: MessageStatus;
  createdAt: Date;
}

function failStale(q: Sql, roomId: string): Promise<number> {
  return q.exec(
    `UPDATE chat_messages SET status = 'failed'
      WHERE room_id = $1 AND status = 'streaming'
        AND updated_at < now() - interval '2 minutes'`,
    [roomId],
  );
}

function quotaExceeded(
  code: 'room_chat_quota_exceeded' | 'global_chat_quota_exceeded',
  resetAtMs: number,
): ApiError {
  const retryAfter = Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000));
  return new ApiError(code, {
    headers: { 'Retry-After': String(retryAfter) },
    members: { resetAt: new Date(resetAtMs).toISOString() },
  });
}

function upstreamProblem(e: LlmError): ApiError {
  return e.code === 'upstream_rate_limited'
    ? new ApiError(e.code, {
        headers: { 'Retry-After': String(e.retryAfterS ?? 30) },
      })
    : new ApiError(e.code);
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger('Chat');
  private readonly llm: LlmProvider | null;

  constructor(
    private readonly db: Db,
    private readonly access: RoomAccess,
    private readonly snapshots: SnapshotService,
    @Inject(CONFIG) private readonly config: Config,
  ) {
    const { llm } = config;
    this.llm = llm.ok ? LLM_ADAPTERS[llm.provider](llm.settings) : null;
  }

  async list(
    roomId: string,
    token: string | undefined,
    { cursor, limit }: HistoryQuery,
  ): Promise<W<'ChatHistory'>> {
    const id = asRoomId(roomId);
    if (id) await failStale(this.db.q, id);
    return this.access.read(roomId, token, async ({ q, room }) => {
      let rows: MessageRow[];
      const select = `SELECT id, role, author_id AS "authorId", content,
                             evidence_ids AS "evidenceIds", status, created_at AS "createdAt"
                        FROM chat_messages WHERE room_id = $1`;
      if (cursor.kind === 'latest') {
        rows = await q.rows(`${select} ORDER BY seq DESC LIMIT $2`, [room.id, limit + 1]);
      } else {
        const anchor = await q.one<{ seq: number }>(
          'SELECT seq FROM chat_messages WHERE id = $1 AND room_id = $2',
          [cursor.id, room.id],
        );
        if (!anchor) {
          throw new InvalidInput([{ field: cursor.kind, code: 'not_found' }]);
        }
        rows =
          cursor.kind === 'before'
            ? await q.rows(`${select} AND seq < $2 ORDER BY seq DESC LIMIT $3`, [
                room.id,
                anchor.seq,
                limit + 1,
              ])
            : await q.rows(`${select} AND seq > $2 ORDER BY seq ASC LIMIT $3`, [
                room.id,
                anchor.seq,
                limit + 1,
              ]);
      }
      const page = rows.slice(0, limit);
      if (cursor.kind !== 'after') page.reverse();
      return {
        messages: page.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
        hasMore: rows.length > limit,
      };
    });
  }

  async ask(
    roomId: string,
    token: string | undefined,
    question: string,
    sink: FrameSink,
  ): Promise<void> {
    const turn = await this.reserve(roomId, token, question);
    const ctl = new AbortController();
    let events: AsyncGenerator<LlmEvent>;
    let first: string;
    let evidence: string[];
    try {
      const { analysis, labels } = await this.snapshots.analyze(turn.photos, turn.metOn);
      const summary = toChatSummary({ ...turn, analysis, labels });
      evidence = evidenceIdsOf(summary);
      const prompt = buildPrompt(summary, turn.history, question);
      events = withDeadlines(
        this.llm!.stream({ ...prompt, maxTokens: MAX_TOKENS }, ctl.signal),
        ctl,
        this.config.llmDeadlines,
      );
      const r = await events.next();
      if (r.done || r.value.type !== 'text') {
        throw new LlmError('upstream_error', 'empty answer');
      }
      first = r.value.delta;
    } catch (e) {
      ctl.abort();
      await this.save(turn.assistantMessageId, '', 'failed');
      throw e instanceof LlmError ? upstreamProblem(e) : e;
    }

    sink.start();
    sink.write({
      type: 'meta',
      revision: turn.revision,
      userMessageId: turn.userMessageId,
      assistantMessageId: turn.assistantMessageId,
      evidenceIds: evidence,
      quota: turn.quota,
    });
    await this.pump(turn.assistantMessageId, first, events, ctl, sink, evidence);
  }

  private reserve(
    roomId: string,
    token: string | undefined,
    question: string,
  ): Promise<Turn> {
    return this.access.write(roomId, token, async ({ q, room, members, me }) => {
      if (!this.config.llm.ok) {
        throw new ApiError('server_misconfigured', { detail: this.config.llm.reason });
      }
      if (members.length < 2 || members.some((m) => !m.aiConsent)) {
        throw new ApiError('ai_consent_required');
      }
      await failStale(q, room.id);
      const busy = await q.one(
        `SELECT 1 FROM chat_messages WHERE room_id = $1 AND status = 'streaming'`,
        [room.id],
      );
      if (busy) throw new ApiError('chat_busy');

      const limit = this.config.chatRoomHourlyLimit;
      const before = await readRoomQuota(q, room.id, limit);
      if (before.used >= limit) {
        throw quotaExceeded('room_chat_quota_exceeded', Date.parse(before.resetAt));
      }

      const history = await q.rows<HistoryTurn>(
        `SELECT role, content FROM chat_messages
          WHERE room_id = $1 AND status IN ('complete', 'truncated')
          ORDER BY seq DESC LIMIT 10`,
        [room.id],
      );
      const photos = await readRoomPhotos(q, room.id);
      const userMessageId = randomUUID() as MessageId;
      const assistantMessageId = randomUUID() as MessageId;
      await q.exec('INSERT INTO chat_reservations (room_id) VALUES ($1)', [room.id]);
      await q.exec(
        `INSERT INTO chat_messages (id, room_id, role, author_id, content, status)
         VALUES ($1, $2, 'user', $3, $4, 'complete')`,
        [userMessageId, room.id, me.id, question],
      );
      await q.exec(
        `INSERT INTO chat_messages (id, room_id, role, status)
         VALUES ($1, $2, 'assistant', 'streaming')`,
        [assistantMessageId, room.id],
      );
      const quota = await readRoomQuota(q, room.id, limit);

      const now = Date.now();
      const global = await q.one(
        `INSERT INTO chat_usage (day, count) VALUES ($1, 1)
         ON CONFLICT (day) DO UPDATE SET count = chat_usage.count + 1
           WHERE chat_usage.count < $2
         RETURNING count`,
        [kstDate(now), this.config.chatDailyLimit],
      );
      if (!global) {
        throw quotaExceeded('global_chat_quota_exceeded', nextKstMidnightMs(now));
      }

      return unchanged({
        revision: room.revision,
        userMessageId,
        assistantMessageId,
        quota,
        nicknames: members.map((m) => m.nickname),
        metOn: room.metOn,
        photos,
        history: fitHistory(history),
      });
    });
  }

  private async pump(
    id: MessageId,
    first: string,
    events: AsyncGenerator<LlmEvent>,
    ctl: AbortController,
    sink: FrameSink,
    evidence: string[],
  ): Promise<void> {
    let content = first;
    let savedAt = Date.now();
    sink.write({ type: 'text', delta: first });
    try {
      for (;;) {
        const r = await events.next();
        if (r.done) throw new LlmError('upstream_error', 'stream ended without a finish');
        const event = r.value;
        if (event.type === 'finish') {
          const status = event.reason === 'stop' ? 'complete' : 'truncated';
          const kept = await this.save(id, content, status, citedEvidence(content, evidence));
          if (kept) sink.write({ type: 'done', finishReason: event.reason });
          return;
        }
        content += event.delta;
        sink.write({ type: 'text', delta: event.delta });
        if (Date.now() - savedAt >= SAVE_EVERY_MS) {
          savedAt = Date.now();
          if (!(await this.save(id, content))) {
            ctl.abort();
            return;
          }
        }
      }
    } catch (e) {
      ctl.abort();
      if (!(e instanceof LlmError)) {
        this.logger.error(`requestId=${sink.requestId}`, e instanceof Error ? e.stack : String(e));
      }
      await this.save(id, content, 'failed').catch(() => 0);
      sink.write({
        type: 'error',
        code: e instanceof LlmError ? e.code : 'internal_error',
        requestId: sink.requestId,
      });
    } finally {
      sink.end();
    }
  }

  private save(
    id: MessageId,
    content: string,
    status?: Exclude<MessageStatus, 'streaming'>,
    evidenceIds?: string[],
  ): Promise<number> {
    return this.db.q.exec(
      `UPDATE chat_messages
          SET content = $2, status = coalesce($3, status),
              evidence_ids = coalesce($4, evidence_ids), updated_at = now()
        WHERE id = $1 AND status = 'streaming'`,
      [id, content, status ?? null, evidenceIds ?? null],
    );
  }
}
