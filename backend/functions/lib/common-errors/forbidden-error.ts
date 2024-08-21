import { CamsError, CamsErrorOptions } from './cams-error';
import { FORBIDDEN } from './constants';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface ForbiddenErrorOptions extends CamsErrorOptions {}
export class ForbiddenError extends CamsError {
  constructor(module: string, options: ForbiddenErrorOptions = {}) {
    super(module, { status: FORBIDDEN, message: 'Request is Forbidden', ...options });
  }
}
