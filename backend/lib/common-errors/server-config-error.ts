import HttpStatusCodes from '../../../common/src/api/http-status-codes';
import { CamsError, CamsErrorOptions } from './cams-error';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
export interface ServerConfigErrorOptions extends CamsErrorOptions {}

export class ServerConfigError extends CamsError {
  constructor(module: string, options: ServerConfigErrorOptions = {}) {
    super(module, {
      message: 'Server configuration error',
      status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
      ...options,
    });
  }
}
