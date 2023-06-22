  class User {

    private readonly _professionalId: number;
    private readonly _firstName: string;
    private readonly _lastName: string;

    constructor(professionalId: number, firstName: string, lastName: string) {
      this._professionalId = professionalId;
      this._firstName = firstName;
      this._lastName = lastName;
    }

    get professionalId(): number {
      return this._professionalId;
    }

    get firstName(): string {
      return this._firstName;
    }

    get lastName(): string {
      return this._lastName;
    }
  }

  export {User};
