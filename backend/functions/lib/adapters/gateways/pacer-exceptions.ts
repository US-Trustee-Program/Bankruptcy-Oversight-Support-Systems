export class NoPacerToken extends Error {
  constructor() {
    super();
    super.message = 'No token has been stored in the vault yet.';
  }
}
