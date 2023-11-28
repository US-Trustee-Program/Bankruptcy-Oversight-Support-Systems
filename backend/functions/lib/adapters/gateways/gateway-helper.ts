import * as fs from 'fs';
import { CaseDetailInterface, DebtorAttorney, Party } from '../types/cases';
import { QueryResults } from '../types/database';
import { ApplicationContext } from '../types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { ATTORNEYS } from '../../testing/mock-data/debtor-attorneys.mock';
import { DEBTORS } from '../../testing/mock-data/debtors.mock';
import { DXTR_CASE_DOCKET_ENTRIES } from '../../testing/mock-data/case-docket-entries.mock';
import { CaseDocketEntry } from '../../use-cases/case-docket/case-docket.model';

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

  getCaseDocketEntriesMockExtract(): CaseDocketEntry[] {
    return DXTR_CASE_DOCKET_ENTRIES;
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
