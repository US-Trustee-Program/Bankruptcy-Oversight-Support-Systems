import { CamsError, CamsErrorOptions } from './cams-error';
import HttpStatusCodes from '../../../common/src/api/http-status-codes';

interface ForbiddenErrorOptions extends CamsErrorOptions {}
export class ForbiddenError extends CamsError {
  constructor(module: string, options: ForbiddenErrorOptions = {}) {
    super(module, {
      status: HttpStatusCodes.FORBIDDEN,
      message: 'Request is Forbidden',
      ...options,
    });
  }
}
