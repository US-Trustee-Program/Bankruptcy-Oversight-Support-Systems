import { CamsError, CamsErrorOptions } from '../../common-errors/cams-error';
import HttpStatusCodes from '@common/api/http-status-codes';

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface AssignmentErrorOptions extends CamsErrorOptions {}

export class AssignmentError extends CamsError {
  constructor(module: string, options: AssignmentErrorOptions = {}) {
    super(module, { status: HttpStatusCodes.BAD_REQUEST, ...options });
  }
}
