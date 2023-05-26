import {Entities} from "../../Entities/User";

export namespace UseCases.Login {

  export class LoginUser {
      _user: Entities.User;

      getUserId(firstName: string, lastName: string) : number {
        return 1;
      }

  }
}