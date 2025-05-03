import HttpStatusCodes from '../../../common/src/api/http-status-codes';
import { CamsError, CamsErrorOptions } from './cams-error';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface UnauthorizedErrorOptions extends CamsErrorOptions {}

export class UnauthorizedError extends CamsError {
  constructor(module: string, options: UnauthorizedErrorOptions = {}) {
    super(module, { message: 'Unauthorized', status: HttpStatusCodes.UNAUTHORIZED, ...options });
  }
}
