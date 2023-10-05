import { CamsError, CamsErrorOptions } from './cams-error';

export interface ServerConfigErrorOptions extends CamsErrorOptions {}

export class ServerConfigError extends CamsError {
  constructor(module: string, options: ServerConfigErrorOptions = {}) {
    super(module, { message: 'Server configuration error', ...options });
  }
}
