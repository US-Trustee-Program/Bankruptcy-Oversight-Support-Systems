import { CamsError, CamsErrorOptions } from './cams-error';
import HttpStatusCodes from '../../../common/src/api/http-status-codes';

export interface ServerConfigErrorOptions extends CamsErrorOptions {}

export class ServerConfigError extends CamsError {
  constructor(module: string, options: ServerConfigErrorOptions = {}) {
    super(module, {
      status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
      message: 'Server configuration error',
      ...options,
    });
  }
}
