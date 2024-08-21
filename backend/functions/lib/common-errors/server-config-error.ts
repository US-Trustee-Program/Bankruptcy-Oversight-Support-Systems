import { CamsError, CamsErrorOptions } from './cams-error';
import { INTERNAL_SERVER_ERROR } from './constants';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
export interface ServerConfigErrorOptions extends CamsErrorOptions {}

export class ServerConfigError extends CamsError {
  constructor(module: string, options: ServerConfigErrorOptions = {}) {
    super(module, {
      status: INTERNAL_SERVER_ERROR,
      message: 'Server configuration error',
      ...options,
    });
  }
}
