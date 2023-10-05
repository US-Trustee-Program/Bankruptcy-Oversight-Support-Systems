import { CamsError } from './cams-error';

export class ForbiddenError extends CamsError {
  originalError: Error;

  constructor(module: string, error: Error) {
    const message = error.message || 'Unknown error';
    super(403, message, module);
    this.originalError = error;
  }
}
