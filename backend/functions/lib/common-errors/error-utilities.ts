import { CamsError, isCamsError } from './cams-error';
import { UnknownError } from './unknown-error';

export function getCamsError(originalError: Error, module: string): CamsError {
  const error = isCamsError(originalError)
    ? originalError
    : new UnknownError(module, { originalError });
  return error;
}
