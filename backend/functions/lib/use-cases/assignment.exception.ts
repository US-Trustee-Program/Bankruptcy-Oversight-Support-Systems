import { CamsError, CamsErrorOptions } from '../common-errors/cams-error';

export interface AssignmentErrorOptions extends CamsErrorOptions {}

export class AssignmentError extends CamsError {
  constructor(module: string, options: AssignmentErrorOptions = {}) {
    super(module, { status: 400, ...options });
  }
}
