import { CamsError, CamsErrorOptions } from '../../common-errors/cams-error';
import HttpStatusCodes from '@common/api/http-status-codes';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface CaseNotesErrorOptions extends CamsErrorOptions {}

export class ForbiddenCaseNotesError extends CamsError {
  constructor(module: string, options: CaseNotesErrorOptions = {}) {
    super(module, { status: HttpStatusCodes.FORBIDDEN, ...options });
  }
}

export class InvalidCaseNotesError extends CamsError {
  constructor(module: string, options: CaseNotesErrorOptions = {}) {
    super(module, { status: HttpStatusCodes.BAD_REQUEST, ...options });
  }
}
