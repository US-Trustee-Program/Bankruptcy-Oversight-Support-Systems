export class NoPacerToken extends Error {
  constructor() {
    super();
    super.message = 'No token has been stored in the vault yet.';
  }
}

export class CaseLocatorException extends Error {
  status: number;

  constructor(status: number, message: string) {
    super();
    super.message = message;
    this.status = status;
  }
}
