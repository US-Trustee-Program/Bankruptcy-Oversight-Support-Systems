import HttpStatusCodes from '@common/api/http-status-codes';
import * as util from 'node:util';

export type CamsStackInfo = {
  module: string;
  message?: string;
};

export interface CamsErrorOptions {
  status?: number;
  message?: string;
  originalError?: Error;
  data?: object;
  camsStackInfo?: CamsStackInfo;
}

export class CamsError extends Error {
  isCamsError: true;
  status: number;
  module: string;
  camsStack: CamsStackInfo[];
  originalError?: string;
  data?: object;

  constructor(module: string, options: CamsErrorOptions = {}) {
    super();
    this.message = options.message || 'Unknown CAMS Error';

    this.status = options.status ?? HttpStatusCodes.INTERNAL_SERVER_ERROR;
    this.module = module;
    this.originalError = util.inspect(options.originalError);
    this.data = options.data;
    this.isCamsError = true;
    this.camsStack = options.camsStackInfo ? [options.camsStackInfo] : [];
  }
}

export function isCamsError(error: unknown): error is CamsError {
  return error instanceof Object && 'isCamsError' in error;
}
