import { CamsError, CamsErrorOptions } from '../../common-errors/cams-error';
import HttpStatusCodes from '@common/api/http-status-codes';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface TrusteeNotesErrorOptions extends CamsErrorOptions {}

export class ForbiddenTrusteeNotesError extends CamsError {
  constructor(module: string, options: TrusteeNotesErrorOptions = {}) {
    super(module, { status: HttpStatusCodes.FORBIDDEN, ...options });
  }
}
// TODO: does this need to be implemented still? Or removed?
export class InvalidTrusteeNotesError extends CamsError {
  constructor(module: string, options: TrusteeNotesErrorOptions = {}) {
    super(module, { status: HttpStatusCodes.BAD_REQUEST, ...options });
  }
}
