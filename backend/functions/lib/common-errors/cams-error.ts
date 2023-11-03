import { INTERNAL_SERVER_ERROR } from './constants';

export interface CamsErrorOptions {
  status?: number;
  message?: string;
  originalError?: Error;
  // TODO: I'm a bit concerned about data being an object. Maybe it should be a string?
  data?: object;
}

export class CamsError extends Error {
  status: number;
  module: string;
  originalError?: Error;
  data?: object;

  constructor(module: string, options: CamsErrorOptions = {}) {
    super();
    this.message = options.message || options.originalError?.message || 'Unknown CAMS Error';
    this.status = options.status ?? INTERNAL_SERVER_ERROR;
    this.module = module;
    this.originalError = options.originalError;
    this.data = options.data;
  }
}
