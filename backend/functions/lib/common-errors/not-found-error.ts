import { CamsError, CamsErrorOptions } from './cams-error';
import { NOT_FOUND } from './constants';

interface NotFoundErrorOptions extends CamsErrorOptions {}
export class NotFoundError extends CamsError {
  constructor(module: string, options: NotFoundErrorOptions = {}) {
    super(module, { status: NOT_FOUND, message: 'Not found', ...options });
  }
}
