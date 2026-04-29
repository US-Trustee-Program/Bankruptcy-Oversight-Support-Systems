import { CamsError, CamsErrorOptions } from './cams-error';
import HttpStatusCodes from '@common/api/http-status-codes';

export class TooManyRequestsError extends CamsError {
  constructor(module: string, options: CamsErrorOptions = {}) {
    super(module, {
      status: HttpStatusCodes.TOO_MANY_REQUESTS,
      ...options,
      message: options.message ?? 'Too Many Requests',
    });
  }
}

export function isTooManyRequestsError(error: unknown): error is TooManyRequestsError {
  return error instanceof TooManyRequestsError;
}
