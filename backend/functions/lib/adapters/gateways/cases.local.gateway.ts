import { CasesInterface } from '../../use-cases/cases.interface';
import { ApplicationContext } from '../types/basic';
import { CaseDetailInterface } from '../types/cases';
import { GatewayHelper } from './gateway-helper';
import log from '../services/logger.service';
import { getMonthDayYearStringFromDate } from '../utils/date-helper';

const MODULE_NAME = 'CASES-LOCAL-GATEWAY';

export class CasesLocalGateway implements CasesInterface {
  getCases = async (
    context: ApplicationContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: {
      startingMonth?: number;
    },
  ): Promise<CaseDetailInterface[]> => {
    const gatewayHelper = new GatewayHelper();
    let cases: CaseDetailInterface[];

    try {
      cases = gatewayHelper.getAllCasesMockExtract();
      cases.forEach((bCase) => {
        bCase.dateFiled = getMonthDayYearStringFromDate(new Date(bCase.dateFiled));
      });
    } catch (err) {
      log.error(context, MODULE_NAME, 'Failed to read mock cases.', err);
      const message = (err as Error).message;
      return Promise.reject(message);
    }

    return cases;
  };

  async getCaseDetail(context: ApplicationContext, caseId: string): Promise<CaseDetailInterface> {
    const gatewayHelper = new GatewayHelper();
    let caseDetail;

    try {
      const cases = gatewayHelper.getAllCasesMockExtract();
      caseDetail = cases.find((bCase) => {
        return bCase.caseId === caseId;
      });
      const debtors = gatewayHelper.getAllDebtorsMockExtract();
      const debtorAttorneys = gatewayHelper.getAllDebtorAttorneysMockExtract();

      caseDetail.dateFiled = caseDetail.dateFiled
        ? getMonthDayYearStringFromDate(new Date(caseDetail.dateFiled))
        : undefined;
      caseDetail.dateClosed = caseDetail.dateClosed
        ? getMonthDayYearStringFromDate(new Date(caseDetail.dateClosed))
        : undefined;
      caseDetail.dismissedDate = caseDetail.dismissedDate
        ? getMonthDayYearStringFromDate(new Date(caseDetail.dismissedDate))
        : undefined;
      caseDetail.reopenedDate = caseDetail.reopenedDate
        ? getMonthDayYearStringFromDate(new Date(caseDetail.reopenedDate))
        : undefined;
      caseDetail.debtor = debtors.get(caseDetail.caseId);
      caseDetail.debtorAttorney = debtorAttorneys.get(caseDetail.caseId);
      caseDetail.judgeName = 'Bob Seger';
    } catch (err) {
      log.error(context, MODULE_NAME, `Failed to read mock case detail for ${caseId}.`, err);
      const message = (err as Error).message;
      return Promise.reject(message);
    }
    return caseDetail;
  }
}
