import * as util from 'node:util';

import HttpStatusCodes from '../../../common/src/api/http-status-codes';

export interface CamsErrorOptions {
  camsStackInfo?: CamsStackInfo;
  data?: object;
  message?: string;
  originalError?: Error;
  status?: number;
}

export type CamsStackInfo = {
  message?: string;
  module: string;
};

export class CamsError extends Error {
  camsStack: CamsStackInfo[];
  data?: object;
  isCamsError: true;
  module: string;
  originalError?: string;
  status: number;

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
