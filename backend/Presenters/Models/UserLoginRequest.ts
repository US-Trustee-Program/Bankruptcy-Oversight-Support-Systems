export namespace Presenters.Models {

  export class UserLoginRequest {
      private _firstName: string;
      private _lastName: string;

      constructor(firstName: string, lastName: string) {
        this._firstName = firstName;
        this._lastName = lastName;
      }
  }
}