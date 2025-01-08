import { CamsError, CamsErrorOptions } from '../../common-errors/cams-error';
import HttpStatusCodes from '../../../../common/src/api/http-status-codes';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
export interface CaseNotesErrorOptions extends CamsErrorOptions {}

export class CaseNotesError extends CamsError {
  constructor(module: string, options: CaseNotesErrorOptions = {}) {
    super(module, { status: HttpStatusCodes.BAD_REQUEST, ...options });
  }
}
