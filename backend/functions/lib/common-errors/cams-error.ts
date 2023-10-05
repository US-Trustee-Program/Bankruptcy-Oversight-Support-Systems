export interface CamsErrorOptions {
  status?: number;
  message?: string;
  originalError?: Error;
}

export class CamsError extends Error {
  status: number;
  module: string;
  originalError?: Error;

  constructor(module: string, options: CamsErrorOptions = {}) {
    super();
    this.message = options.message || options.originalError?.message || 'Unknown CAMS Error';
    this.status = options.status ?? 500;
    this.module = module;
  }
}
