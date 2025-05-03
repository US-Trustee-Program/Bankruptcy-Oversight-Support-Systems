import HttpStatusCodes from '../../../common/src/api/http-status-codes';
import { CamsError, CamsErrorOptions } from './cams-error';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
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
