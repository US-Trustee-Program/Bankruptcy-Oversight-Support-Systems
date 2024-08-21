import { CamsError, CamsErrorOptions } from './cams-error';
import { NOT_FOUND } from './constants';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface NotFoundErrorOptions extends CamsErrorOptions {}
export class NotFoundError extends CamsError {
  constructor(module: string, options: NotFoundErrorOptions = {}) {
    super(module, { status: NOT_FOUND, message: 'Not found', ...options });
  }
}
