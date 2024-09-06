import { CamsError, CamsErrorOptions } from './cams-error';
import HttpStatusCodes from '../../../../common/src/api/http-status-codes';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface NotFoundErrorOptions extends CamsErrorOptions {}
export class NotFoundError extends CamsError {
  constructor(module: string, options: NotFoundErrorOptions = {}) {
    super(module, { status: HttpStatusCodes.NOT_FOUND, message: 'Not found', ...options });
  }
}
