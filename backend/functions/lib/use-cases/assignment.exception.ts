import { CamsError, CamsErrorOptions } from '../common-errors/cams-error';
import { BAD_REQUEST } from '../common-errors/constants';

export interface AssignmentErrorOptions extends CamsErrorOptions {}

export class AssignmentError extends CamsError {
  constructor(module: string, options: AssignmentErrorOptions = {}) {
    super(module, { status: BAD_REQUEST, ...options });
  }
}
