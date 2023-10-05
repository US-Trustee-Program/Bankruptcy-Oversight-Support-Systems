import { CamsError, CamsErrorOptions } from './cams-error';

interface ForbiddenErrorOptions extends CamsErrorOptions {}
export class ForbiddenError extends CamsError {
  constructor(module: string, options: ForbiddenErrorOptions = {}) {
    super(module, { status: 403, message: 'Request is Forbidden', ...options });
  }
}
