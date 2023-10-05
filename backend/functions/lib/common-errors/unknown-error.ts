import { CamsError } from './cams-error';

interface UnknownErrorOptions {
  status?: number;
  message?: string;
}

export class UnknownError extends CamsError {
  originalError: Error;

  constructor(module: string, error: Error, options: UnknownErrorOptions = {}) {
    const message = options.message || error.message || 'Unknown error';
    super(options.status || 500, message, module);
    this.originalError = error;
  }
}
