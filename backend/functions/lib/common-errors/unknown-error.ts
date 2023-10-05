import { CamsError, CamsErrorOptions } from './cams-error';

interface UnknownErrorOptions extends CamsErrorOptions {}

export class UnknownError extends CamsError {
  constructor(module: string, options: UnknownErrorOptions = {}) {
    super(module, { status: 500, message: 'Unknown error', ...options });
  }
}
