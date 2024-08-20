import { CamsError, CamsErrorOptions } from './cams-error';
import { UNAUTHORIZED } from './constants';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface UnauthorizedErrorOptions extends CamsErrorOptions {}

export class UnauthorizedError extends CamsError {
  constructor(module: string, options: UnauthorizedErrorOptions = {}) {
    super(module, { status: UNAUTHORIZED, message: 'Unauthorized', ...options });
  }
}
