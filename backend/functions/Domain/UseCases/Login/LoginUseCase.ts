import {User} from "../../Entities/User";

export namespace UseCases.Login {

  export class LoginUser {
      _user: User;

      getUserId(firstName: string, lastName: string) : number {
        return 1;
      }

  }
}
