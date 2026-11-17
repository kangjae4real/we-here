import { NotFoundException } from '@nestjs/common';
import { InvalidInput } from '../core/input.js';
import { ApiError, toApiError } from './problem.js';

describe('toApiError', () => {
  it('keeps an ApiError as thrown', () => {
    const e = new ApiError('room_full');
    expect(toApiError(e)).toBe(e);
  });

  it('turns rejected input into validation_failed with its issues', () => {
    const e = toApiError(
      new InvalidInput([{ field: 'nickname', code: 'too_long' }]),
    );
    expect(e.code).toBe('validation_failed');
    expect(e.options.errors).toEqual([{ field: 'nickname', code: 'too_long' }]);
  });

  it('answers unknown routes with 404', () => {
    const e = toApiError(new NotFoundException());
    expect(e.options.status).toBe(404);
  });

  it('turns a JSON parse failure into validation_failed', () => {
    const parseError = Object.assign(new SyntaxError('bad'), {
      type: 'entity.parse.failed',
      status: 400,
    });
    expect(toApiError(parseError).code).toBe('validation_failed');
  });

  it('hides anything unexpected behind internal_error', () => {
    expect(toApiError(new Error('boom')).code).toBe('internal_error');
  });
});
