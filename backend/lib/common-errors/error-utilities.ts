import { CamsError, CamsErrorOptions, CamsStackInfo, isCamsError } from './cams-error';
import { UnknownError } from './unknown-error';

export function getCamsError(originalError: Error, module: string, message?: string): CamsError {
  const error = isCamsError(originalError)
    ? originalError
    : new UnknownError(module, { message, originalError });
  return error;
}

export function getCamsErrorWithStack(
  originalError: Error,
  module: string,
  options: CamsErrorOptions,
): CamsError {
  const error = isCamsError(originalError)
    ? addCamsStack(originalError, options.camsStackInfo)
    : new UnknownError(module, {
        message: options.message,
        originalError,
        camsStackInfo: options.camsStackInfo,
      });
  return error;
}

function addCamsStack(error: CamsError, camsStackInfo: CamsStackInfo) {
  error.camsStack.push(camsStackInfo);
  return error;
}
