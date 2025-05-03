import * as fs from 'fs';

import { CaseDetail, CaseDocketEntry } from '../../../../common/src/cams/cases';
import { CaseAssignmentHistory } from '../../../../common/src/cams/history';
import { DebtorAttorney, Party } from '../../../../common/src/cams/parties';
import { CamsError } from '../../common-errors/cams-error';
import { DXTR_CASE_DOCKET_ENTRIES } from '../../testing/mock-data/case-docket-entries.mock';
import { CASE_HISTORY } from '../../testing/mock-data/case-history.mock';
import { DEBTOR_ATTORNEYS } from '../../testing/mock-data/debtor-attorneys.mock';
import { DEBTORS } from '../../testing/mock-data/debtors.mock';
import { ApplicationContext } from '../types/basic';
import { QueryResults } from '../types/database';

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

  getAllDebtorAttorneysMockExtract(): Map<string, DebtorAttorney> {
    return DEBTOR_ATTORNEYS;
  }

  getAllDebtorsMockExtract(): Map<string, Party> {
    return DEBTORS;
  }

  getCaseDocketEntriesMockExtract(): CaseDocketEntry[] {
    return DXTR_CASE_DOCKET_ENTRIES;
  }

  getCaseHistoryMockExtract(): CaseAssignmentHistory[] {
    return CASE_HISTORY;
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
