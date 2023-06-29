export namespace Domain.Interfaces{

  export interface IUserRepository {

    GetUserId(firstName: string, lastName: string): number;
  }
}
