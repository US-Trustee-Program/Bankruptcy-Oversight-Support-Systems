export class CamsError extends Error {
  status: number;
  module: string;

  constructor(status: number, message: string, module: string) {
    super();
    super.message = message;
    this.status = status;
    this.module = module;
  }
}

interface UnknownErrorParams {
  status?: number;
  message?: string;
}

export class UnknownError extends CamsError {
  originalError: Error;

  constructor(module: string, error: Error, options: UnknownErrorParams = {}) {
    const message = options.message || error.message || 'Unknown error';
    super(options.status || 500, message, module);
    this.originalError = error;
  }
}
