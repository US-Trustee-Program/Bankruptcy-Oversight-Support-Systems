import { CamsError } from './cams-error';

export function toCamsError(originalError: Error, statusCode: number) {
  if (originalError instanceof CamsError) return originalError;

  // TODO: pull statusCode out of params and get it from originalError
  if (statusCode === UNAUTHORIZED) {
    return new UnauthorizedError();
  } else if (statusCode === FORBIDDEN) {
    return new ForbiddenError(props);
  } else if (isNotFoundStatus) {
    return new NotFoundError(props);
  } else {
    return new CamsError(props);
  }
}
