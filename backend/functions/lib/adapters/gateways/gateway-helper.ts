import * as fs from 'fs';
import * as mssql from 'mssql';
import { CaseDetailInterface, DebtorAttorney, Party } from '../types/cases';
import { QueryResults } from '../types/database';
import { ApplicationContext } from '../types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { ATTORNEYS } from '../../testing/mock-data/debtor-attorneys.mock';
import { DEBTORS } from '../../testing/mock-data/debtors.mock';

export class GatewayHelper {
  getAllCasesMockExtract(): CaseDetailInterface[] {
    const filename = './lib/testing/mock-data/cases.mock.json';

    try {
      const data = fs.readFileSync(filename, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      throw Error(err);
    }
  }

  getAllDebtorsMockExtract(): Map<string, Party> {
    return DEBTORS;
  }

  getAllDebtorAttorneysMockExtract(): Map<string, DebtorAttorney> {
    return ATTORNEYS;
  }
}

export function handleQueryResult<T>(
  applicationContext: ApplicationContext,
  queryResult: QueryResults,
  moduleName: string,
  callback: (appContext: ApplicationContext, queryResult: QueryResults) => T,
): T {
  if (queryResult.success) {
    return callback(applicationContext, queryResult);
  } else {
    throw new CamsError(moduleName, { message: queryResult.message });
  }
}

export async function handleQueryResult2<T>(moduleName: string, queryResult: QueryResults) {
  if (queryResult.success) {
    return (queryResult.results as mssql.IResult<T>).recordset;
  } else {
    throw new CamsError(moduleName, { message: queryResult.message });
  }
}
