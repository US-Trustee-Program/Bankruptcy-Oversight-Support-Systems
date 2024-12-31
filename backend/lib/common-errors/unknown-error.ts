import { CamsError, CamsErrorOptions } from './cams-error';
import HttpStatusCodes from '../../../common/src/api/http-status-codes';

interface UnknownErrorOptions extends CamsErrorOptions {}

export class UnknownError extends CamsError {
  constructor(module: string, options: UnknownErrorOptions = {}) {
    super(module, {
      status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
      ...options,
      message: options.message ?? 'Unknown Error',
    });
  }
}
