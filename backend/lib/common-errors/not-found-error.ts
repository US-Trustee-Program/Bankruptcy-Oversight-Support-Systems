import { CamsError, CamsErrorOptions, isCamsError } from './cams-error';
import HttpStatusCodes from 'common/api/http-status-codes';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface NotFoundErrorOptions extends CamsErrorOptions {}
export class NotFoundError extends CamsError {
  constructor(module: string, options: NotFoundErrorOptions = {}) {
    super(module, { status: HttpStatusCodes.NOT_FOUND, message: 'Not found', ...options });
  }
}

export function isNotFoundError(obj: unknown): obj is NotFoundError {
  return isCamsError(obj) && obj.status === HttpStatusCodes.NOT_FOUND;
}
