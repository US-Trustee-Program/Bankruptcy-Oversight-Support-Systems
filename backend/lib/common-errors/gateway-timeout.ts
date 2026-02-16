import { CamsError, CamsErrorOptions } from './cams-error';
import HttpStatusCodes from '@common/api/http-status-codes';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface GatewayTimeoutErrorOptions extends CamsErrorOptions {}

export class GatewayTimeoutError extends CamsError {
  constructor(module: string, options: GatewayTimeoutErrorOptions = {}) {
    super(module, {
      status: HttpStatusCodes.GATEWAY_TIMEOUT,
      ...options,
      message: options.message ?? 'Gateway Timeout',
    });
  }
}
