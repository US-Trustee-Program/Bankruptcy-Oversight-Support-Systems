import { CamsError } from './cams-error';

export class ServerConfigError extends CamsError {
  originalError: Error;

  constructor(module: string, error: Error, message?: string) {
    message = message || error.message || 'Server config error';
    super(500, message, module);
    this.originalError = error;
  }
}
