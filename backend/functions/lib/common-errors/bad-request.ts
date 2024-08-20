import { CamsError, CamsErrorOptions } from './cams-error';
import { BAD_REQUEST } from './constants';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface BadRequestErrorOptions extends CamsErrorOptions {}
export class BadRequestError extends CamsError {
  constructor(module: string, options: BadRequestErrorOptions = {}) {
    super(module, { status: BAD_REQUEST, message: 'Bad request', ...options });
  }
}
