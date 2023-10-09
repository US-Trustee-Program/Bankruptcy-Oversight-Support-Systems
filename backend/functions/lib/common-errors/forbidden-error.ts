import { CamsError, CamsErrorOptions } from './cams-error';
import { FORBIDDEN } from './constants';

interface ForbiddenErrorOptions extends CamsErrorOptions {}
export class ForbiddenError extends CamsError {
  constructor(module: string, options: ForbiddenErrorOptions = {}) {
    super(module, { status: FORBIDDEN, message: 'Request is Forbidden', ...options });
  }
}
