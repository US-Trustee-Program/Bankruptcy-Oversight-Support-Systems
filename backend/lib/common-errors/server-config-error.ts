import { CamsError, CamsErrorOptions } from './cams-error';
import HttpStatusCodes from 'common/api/http-status-codes';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface ServerConfigErrorOptions extends CamsErrorOptions {}

export const UNSUPPORTED_AUTHENTICATION_PROVIDER = 'Unsupported authentication provider.';

export class ServerConfigError extends CamsError {
  constructor(module: string, options: ServerConfigErrorOptions = {}) {
    super(module, {
      status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
      message: 'Server configuration error',
      ...options,
    });
  }
}
