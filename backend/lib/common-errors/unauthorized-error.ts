import { CamsError, CamsErrorOptions } from './cams-error';
import HttpStatusCodes from 'common/api/http-status-codes';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface UnauthorizedErrorOptions extends CamsErrorOptions {}

export class UnauthorizedError extends CamsError {
  constructor(module: string, options: UnauthorizedErrorOptions = {}) {
    super(module, { status: HttpStatusCodes.UNAUTHORIZED, message: 'Unauthorized', ...options });
  }
}
