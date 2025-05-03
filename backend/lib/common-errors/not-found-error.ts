import HttpStatusCodes from '../../../common/src/api/http-status-codes';
import { CamsError, CamsErrorOptions, isCamsError } from './cams-error';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface NotFoundErrorOptions extends CamsErrorOptions {}
export class NotFoundError extends CamsError {
  constructor(module: string, options: NotFoundErrorOptions = {}) {
    super(module, { message: 'Not found', status: HttpStatusCodes.NOT_FOUND, ...options });
  }
}

export function isNotFoundError(obj: unknown): obj is NotFoundError {
  return isCamsError(obj) && obj.status === HttpStatusCodes.NOT_FOUND;
}
