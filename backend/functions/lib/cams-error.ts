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
