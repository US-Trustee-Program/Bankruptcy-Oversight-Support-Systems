import { CamsError, CamsErrorOptions } from './cams-error';
import HttpStatusCodes from '../../../common/src/api/http-status-codes';

interface BadRequestErrorOptions extends CamsErrorOptions {}
export class BadRequestError extends CamsError {
  constructor(module: string, options: BadRequestErrorOptions = {}) {
    super(module, {
      status: HttpStatusCodes.BAD_REQUEST,
      message: 'Bad request',
      ...options,
    });
  }
}
