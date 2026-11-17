import type { Request, Response } from 'express';
import multer from 'multer';
import { issuesOf, OPERATIONS, validatorFor } from '../contract/index.js';
import { type FieldIssue, InvalidInput } from '../core/input.js';
import {
  type ItemVerdict,
  judgeItem,
  type PhotoErrorCode,
  type PhotoMeta,
} from '../core/photo.js';
import { ApiError } from '../http/problem.js';

export const MAX_ITEMS = 50;
export const MAX_BATCH_BYTES = 2 * 1024 * 1024;
const FRAMING_BYTES = 64 * 1024;
const THUMB_PART = /^thumb_(0|[1-9]\d{0,5})$/;

const PHOTO_FIELD_CODE = {
  clientIndex: 'batch',
  dedupeKey: 'invalid_dedupe_key',
  lat: 'invalid_lat',
  lng: 'invalid_lng',
  dateTimeOriginal: 'invalid_datetime',
  subSecTimeOriginal: 'invalid_datetime',
  offsetTimeOriginal: 'invalid_datetime',
  gpsDateStamp: 'invalid_datetime',
  gpsTimeStamp: 'invalid_datetime',
  make: 'batch',
  model: 'batch',
} as const satisfies Record<keyof PhotoMeta, PhotoErrorCode | 'batch'>;

const MULTER_TOO_LARGE = new Set<string>([
  'LIMIT_PART_COUNT',
  'LIMIT_FILE_COUNT',
  'LIMIT_FILE_SIZE',
  'LIMIT_FIELD_VALUE',
]);

const multipart = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BATCH_BYTES,
    fieldSize: MAX_BATCH_BYTES,
    fields: 1,
    files: MAX_ITEMS + 1,
    parts: MAX_ITEMS + 1,
  },
}).any();

const tooLarge = () => new ApiError('batch_too_large');
const invalid = (field: string, code: FieldIssue['code']) =>
  new InvalidInput([{ field, code }]);

export async function readUpload(
  req: Request,
  res: Response,
  nowMs: number,
): Promise<ItemVerdict[]> {
  if (!req.is('multipart/form-data')) throw invalid('meta', 'required');
  if (Number(req.headers['content-length']) > MAX_BATCH_BYTES + FRAMING_BYTES) {
    throw tooLarge();
  }
  await new Promise<void>((resolve, reject) =>
    multipart(req, res, (e?: unknown) => (e ? reject(e) : resolve())),
  ).catch((e: unknown) => {
    if (e instanceof multer.MulterError && MULTER_TOO_LARGE.has(e.code)) {
      throw tooLarge();
    }
    throw invalid(
      e instanceof multer.MulterError ? (e.field ?? 'body') : 'body',
      'invalid_format',
    );
  });

  const files = (req.files ?? []) as Express.Multer.File[];
  const fields = (req.body ?? {}) as Record<string, unknown>;
  const metaFile = files.filter((f) => f.fieldname === 'meta');
  const metaField = fields.meta;
  for (const name of Object.keys(fields)) {
    if (name !== 'meta') throw invalid(name, 'unknown_field');
  }
  if (metaFile.length + (typeof metaField === 'string' ? 1 : 0) !== 1) {
    throw invalid('meta', 'required');
  }
  const metaText =
    typeof metaField === 'string'
      ? metaField
      : metaFile[0].buffer.toString('utf8');

  const thumbs = new Map<number, Uint8Array>();
  let bytes = Buffer.byteLength(metaText);
  for (const f of files) {
    if (f.fieldname === 'meta') continue;
    const m = THUMB_PART.exec(f.fieldname);
    if (!m) throw invalid(f.fieldname, 'unknown_field');
    if (thumbs.has(Number(m[1]))) throw invalid(f.fieldname, 'conflict');
    thumbs.set(Number(m[1]), f.buffer);
    bytes += f.size;
  }
  if (bytes > MAX_BATCH_BYTES) throw tooLarge();

  return judgeBatch(parseMeta(metaText), thumbs, nowMs);
}

function parseMeta(text: string): unknown[] {
  let meta: unknown;
  try {
    meta = JSON.parse(text);
  } catch {
    throw invalid('meta', 'invalid_format');
  }
  if (!Array.isArray(meta)) throw invalid('meta', 'invalid_type');
  if (meta.length === 0) throw invalid('meta', 'too_short');
  if (meta.length > MAX_ITEMS) throw tooLarge();
  return meta;
}

const PHOTO_META_SCHEMA =
  OPERATIONS.uploadPhotos.requestBody.schema.properties.meta.items;

function judgeBatch(
  items: unknown[],
  thumbs: ReadonlyMap<number, Uint8Array>,
  nowMs: number,
): ItemVerdict[] {
  const validate = validatorFor(PHOTO_META_SCHEMA);
  const batchIssues: FieldIssue[] = [];
  const seen = new Set<number>();
  const verdicts: ItemVerdict[] = [];

  items.forEach((item, i) => {
    const at = (field: string) => `meta.${i}${field ? `.${field}` : ''}`;
    if (validate(item)) {
      const meta = item as PhotoMeta;
      if (seen.has(meta.clientIndex)) {
        batchIssues.push({ field: at('clientIndex'), code: 'conflict' });
      }
      seen.add(meta.clientIndex);
      verdicts.push(judgeItem(meta, thumbs.get(meta.clientIndex), nowMs));
      return;
    }
    const issues = issuesOf(validate.errors ?? []);
    const perPhoto = issues.map((issue) =>
      issue.field in PHOTO_FIELD_CODE
        ? PHOTO_FIELD_CODE[issue.field as keyof PhotoMeta]
        : 'batch',
    );
    const firstPhotoCode = perPhoto.find((c) => c !== 'batch');
    if (perPhoto.includes('batch') || !firstPhotoCode) {
      issues.forEach((issue, n) => {
        if (perPhoto[n] === 'batch') {
          batchIssues.push({
            ...issue,
            field: at(issue.field === 'body' ? '' : issue.field),
          });
        }
      });
      return;
    }
    const { clientIndex, dedupeKey } = item as Record<string, unknown>;
    seen.add(clientIndex as number);
    verdicts.push({
      clientIndex: clientIndex as number,
      dedupeKey: typeof dedupeKey === 'string' ? dedupeKey : '',
      ok: false,
      error: {
        code: firstPhotoCode,
        field: issues[perPhoto.indexOf(firstPhotoCode)].field,
      },
    });
  });

  for (const n of thumbs.keys()) {
    if (!seen.has(n))
      batchIssues.push({ field: `thumb_${n}`, code: 'unknown_field' });
  }
  if (batchIssues.length) throw new InvalidInput(batchIssues);
  return verdicts;
}
