import { CamsError, CamsErrorOptions, CamsStackInfo, isCamsError } from './cams-error';
import { UnknownError } from './unknown-error';

export function getCamsError(originalError: Error, module: string, message?: string): CamsError {
  return isCamsError(originalError)
    ? originalError
    : new UnknownError(module, { message, originalError });
}

export function getCamsErrorWithStack(
  originalError: Error,
  module: string,
  options: CamsErrorOptions,
): CamsError {
  return isCamsError(originalError)
    ? addCamsStack(originalError, options.camsStackInfo)
    : new UnknownError(module, {
        message: options.message,
        originalError,
        camsStackInfo: options.camsStackInfo,
      });
}

function addCamsStack(error: CamsError, camsStackInfo: CamsStackInfo) {
  error.camsStack.push(camsStackInfo);
  return error;
}
