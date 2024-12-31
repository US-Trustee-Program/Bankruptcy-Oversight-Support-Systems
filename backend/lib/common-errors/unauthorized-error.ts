import { CamsError, CamsErrorOptions } from './cams-error';
import HttpStatusCodes from '../../../common/src/api/http-status-codes';

interface UnauthorizedErrorOptions extends CamsErrorOptions {}

export class UnauthorizedError extends CamsError {
  constructor(module: string, options: UnauthorizedErrorOptions = {}) {
    super(module, {
      status: HttpStatusCodes.UNAUTHORIZED,
      message: 'Unauthorized',
      ...options,
    });
  }
}
