import HttpStatusCodes from '../../../common/src/api/http-status-codes';
import { CamsError, CamsErrorOptions } from './cams-error';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface ForbiddenErrorOptions extends CamsErrorOptions {}
export class ForbiddenError extends CamsError {
  constructor(module: string, options: ForbiddenErrorOptions = {}) {
    super(module, {
      message: 'Request is Forbidden',
      status: HttpStatusCodes.FORBIDDEN,
      ...options,
    });
  }
}
