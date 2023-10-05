import { CamsError } from '../common-errors/cams-error';

export class AssignmentException extends CamsError {
  constructor(status: number, message: string, module: string = 'ASSIGNMENTS') {
    super(status, message, module);
  }
}
