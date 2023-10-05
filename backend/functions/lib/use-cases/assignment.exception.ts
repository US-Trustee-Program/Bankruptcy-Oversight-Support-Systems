import { CamsError } from '../cams-error';

export class AssignmentException extends CamsError {
  constructor(status: number, message: string) {
    super(status, message, 'ASSIGNMENTS');
  }
}
