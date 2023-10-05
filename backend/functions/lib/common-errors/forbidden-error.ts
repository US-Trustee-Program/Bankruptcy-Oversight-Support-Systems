import { CamsError } from './cams-error';

export class ForbiddenError extends CamsError {
  originalError: Error;

  constructor(module: string, error: Error, message?: string) {
    message = message || error.message || 'Request is Forbidden';
    super(403, message, module);
    this.originalError = error;
  }
}
