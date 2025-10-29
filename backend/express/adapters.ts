import { Response, Request, NextFunction } from 'express';
import { CamsHttpResponseInit } from '../lib/adapters/utils/http-response';
import { getCamsError } from '../lib/common-errors/error-utilities';
import { LoggerImpl } from '../lib/adapters/services/logger.service';

/**
 * Convert CAMS HTTP response to Express response
 */
export function sendCamsResponse<T extends object = undefined>(
  res: Response,
  camsResponse: CamsHttpResponseInit<T>,
): void {
  if (camsResponse.headers) {
    Object.entries(camsResponse.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  const statusCode = camsResponse.statusCode || 200;
  res.status(statusCode);

  if (camsResponse.body) {
    res.json(camsResponse.body);
  } else {
    res.end();
  }
}

/**
 * Express error handling middleware
 * Must be registered last in middleware chain
 */
export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void {
  const MODULE_NAME = 'EXPRESS-ERROR-HANDLER';
  const camsError = getCamsError(error, MODULE_NAME);

  // Create a simple logger for error handling
  const logger = new LoggerImpl(`error-${Date.now()}`, console.log);
  logger.camsError(camsError);

  res.status(camsError.status).json({
    message: camsError.message,
    status: camsError.status,
  });
}
