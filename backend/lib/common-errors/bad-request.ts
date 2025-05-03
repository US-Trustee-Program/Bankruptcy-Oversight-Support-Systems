import HttpStatusCodes from '../../../common/src/api/http-status-codes';
import { CamsError, CamsErrorOptions } from './cams-error';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface BadRequestErrorOptions extends CamsErrorOptions {}
export class BadRequestError extends CamsError {
  constructor(module: string, options: BadRequestErrorOptions = {}) {
    super(module, { message: 'Bad request', status: HttpStatusCodes.BAD_REQUEST, ...options });
  }
}
