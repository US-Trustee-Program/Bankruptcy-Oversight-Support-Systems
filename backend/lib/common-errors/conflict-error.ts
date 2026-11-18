import { CamsError, CamsErrorOptions } from './cams-error';
import HttpStatusCodes from '@common/api/http-status-codes';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface ConflictErrorOptions extends CamsErrorOptions {}
export class ConflictError extends CamsError {
  constructor(module: string, options: ConflictErrorOptions = {}) {
    super(module, {
      status: HttpStatusCodes.CONFLICT,
      message: 'Request conflicts with the current state',
      ...options,
    });
  }
}
