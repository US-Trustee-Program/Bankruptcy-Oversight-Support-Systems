import { CamsError } from './cams-error';
import { FORBIDDEN } from './constants';
import { ForbiddenError } from './forbidden-error';

export function toCamsError(moduleName: string, originalError: Error, statusCode: number) {
  if (originalError instanceof CamsError) return originalError;

  // TODO: pull statusCode out of params and get it from originalError
  if (statusCode === FORBIDDEN) {
    return new ForbiddenError(moduleName, { originalError });
  } else {
    return new CamsError(moduleName, { originalError });
  }
}
