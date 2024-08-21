import { CamsError, CamsErrorOptions } from './cams-error';
import { INTERNAL_SERVER_ERROR } from './constants';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface UnknownErrorOptions extends CamsErrorOptions {}

export class UnknownError extends CamsError {
  constructor(module: string, options: UnknownErrorOptions = {}) {
    super(module, { status: INTERNAL_SERVER_ERROR, message: 'Unknown error', ...options });
  }
}
