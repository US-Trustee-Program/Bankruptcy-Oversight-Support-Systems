import { CamsError, CamsErrorOptions } from '../common-errors/cams-error';
import HttpStatusCodes from '../../../common/src/api/http-status-codes';

export interface AssignmentErrorOptions extends CamsErrorOptions {}

export class AssignmentError extends CamsError {
  constructor(module: string, options: AssignmentErrorOptions = {}) {
    super(module, { status: HttpStatusCodes.BAD_REQUEST, ...options });
  }
}
