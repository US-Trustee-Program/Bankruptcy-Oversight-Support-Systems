import { CamsError, CamsErrorOptions } from './cams-error';
import { UNAUTHORIZED } from './constants';

interface UnauthorizedErrorOptions extends CamsErrorOptions {}
export class UnauthorizedError extends CamsError {
  constructor(module: string, options: UnauthorizedErrorOptions = {}) {
    super(module, { status: UNAUTHORIZED, message: 'Unauthorized', ...options });
  }
}
