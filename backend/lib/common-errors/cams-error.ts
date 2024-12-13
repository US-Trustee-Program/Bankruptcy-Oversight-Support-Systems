import HttpStatusCodes from '../../../common/src/api/http-status-codes';

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
  originalError?: Error;
  data?: object;

  constructor(module: string, options: CamsErrorOptions = {}) {
    super();
    this.message = options.message || 'Unknown CAMS Error';

    this.status = options.status ?? HttpStatusCodes.INTERNAL_SERVER_ERROR;
    this.module = module;
    this.originalError = options.originalError;
    this.data = options.data;
    this.isCamsError = true;
    this.camsStack = [];
  }
}

export function isCamsError(error: unknown): error is CamsError {
  return error instanceof Object && 'isCamsError' in error;
}
