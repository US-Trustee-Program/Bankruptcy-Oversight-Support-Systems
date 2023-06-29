import { Domain } from "../functions/Domain/Interfaces/IUserRepository";
import * as mssql from 'mssql';
import { DbTableFieldSpec } from "../functions/lib/adapters/types/database";

namespace Gateways.Repositories{

  import IUserRepository = Domain.Interfaces.IUserRepository;

  export class AzureSqlUserRepository implements IUserRepository {

    private loginSqlQuery = `SELECT
      PROF_FIRST_NAME AS firstName,
      PROF_MI AS middleInitial,
      PROF_LAST_NAME AS lastName,
      UST_PROF_CODE AS professionalId
    FROM CMMPR
    WHERE
      DELETE_CODE <> 'D'
      AND PROF_FIRST_NAME = @firstName AND PROF_LAST_NAME = @lastName
  `;
    GetUserId(firstName: string, lastName: string): number {
      let input: DbTableFieldSpec[] = [];

      return 0;
    }

  }
}
