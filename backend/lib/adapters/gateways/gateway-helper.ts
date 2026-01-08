import * as fs from 'fs';
import { QueryResults } from '../types/database';
import { ApplicationContext } from '../types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { DEBTOR_ATTORNEYS } from '../../testing/mock-data/debtor-attorneys.mock';
import { DEBTORS } from '../../testing/mock-data/debtors.mock';
import { DXTR_CASE_DOCKET_ENTRIES } from '../../testing/mock-data/case-docket-entries.mock';
import { CASE_HISTORY } from '../../testing/mock-data/case-history.mock';
import { CaseDetail, CaseDocketEntry } from '@common/cams/cases';
import { DebtorAttorney, Party } from '@common/cams/parties';
import { CaseAssignmentHistory } from '@common/cams/history';

export class GatewayHelper {
  getAllCasesMockExtract(): CaseDetail[] {
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

  getCaseHistoryMockExtract(): CaseAssignmentHistory[] {
    return CASE_HISTORY;
  }

  getAllDebtorsMockExtract(): Map<string, Party> {
    return DEBTORS;
  }

  getAllDebtorAttorneysMockExtract(): Map<string, DebtorAttorney> {
    return DEBTOR_ATTORNEYS;
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
