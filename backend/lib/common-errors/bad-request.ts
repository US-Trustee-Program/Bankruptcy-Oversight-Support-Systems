import { CamsError, CamsErrorOptions } from './cams-error';
import HttpStatusCodes from '@common/api/http-status-codes';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface BadRequestErrorOptions extends CamsErrorOptions {}
export class BadRequestError extends CamsError {
  constructor(module: string, options: BadRequestErrorOptions = {}) {
    super(module, { status: HttpStatusCodes.BAD_REQUEST, message: 'Bad request', ...options });
  }
}
