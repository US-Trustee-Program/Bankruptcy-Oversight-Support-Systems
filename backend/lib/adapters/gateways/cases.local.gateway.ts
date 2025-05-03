import { CasesSearchPredicate } from '../../../../common/src/api/search';
import { CaseBasics, CaseDetail } from '../../../../common/src/cams/cases';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsError } from '../../common-errors/cams-error';
import { CasesInterface, TransactionIdRangeForDate } from '../../use-cases/cases/cases.interface';
import { ApplicationContext } from '../types/basic';
import { getMonthDayYearStringFromDate } from '../utils/date-helper';
import { GatewayHelper } from './gateway-helper';

const MODULE_NAME = 'MOCK-CASES-GATEWAY';

export class CasesLocalGateway implements CasesInterface {
  public async findMaxTransactionId(_context: ApplicationContext): Promise<string> {
    throw new Error('Not implemented');
  }

  public async findTransactionIdRangeForDate(
    _context: ApplicationContext,
    _findDate: string,
  ): Promise<TransactionIdRangeForDate> {
    throw new Error('Not implemented');
  }

  async getCaseDetail(applicationContext: ApplicationContext, caseId: string): Promise<CaseDetail> {
    const gatewayHelper = new GatewayHelper();
    let caseDetail;

    try {
      caseDetail = MockData.getCaseDetail({ override: { caseId } });
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
      caseDetail.courtDivisionCode = '081';
      caseDetail.courtDivisionName = 'Manhattan';
      caseDetail.courtName = 'Southern District of New York';
      caseDetail.regionId = '02';
      caseDetail.debtorTypeLabel = 'Corporate Debtor';
      caseDetail.petitionLabel = 'Voluntary';
    } catch (err) {
      applicationContext.logger.error(
        MODULE_NAME,
        `Failed to read mock case detail for ${caseId}.`,
        err,
      );
      const message = (err as Error).message;
      return Promise.reject(message);
    }
    return caseDetail;
  }

  getCases = async (
    applicationContext: ApplicationContext,
    _options: {
      startingMonth?: number;
    },
  ): Promise<CaseDetail[]> => {
    const gatewayHelper = new GatewayHelper();
    let cases: CaseDetail[];

    try {
      cases = gatewayHelper.getAllCasesMockExtract();
      cases.forEach((bCase) => {
        bCase.dateFiled = getMonthDayYearStringFromDate(new Date(bCase.dateFiled));
      });
    } catch (err) {
      applicationContext.logger.error(MODULE_NAME, 'Failed to read mock cases.', err);
      const message = (err as Error).message;
      return Promise.reject(message);
    }

    return cases;
  };

  getCaseSummary(applicationContext: ApplicationContext, caseId: string): Promise<CaseDetail> {
    let caseDetail;

    try {
      caseDetail = MockData.getCaseDetail({ override: { caseId } });
      caseDetail.courtDivisionCode = caseId.split('-')[0];
    } catch (err) {
      applicationContext.logger.error(
        MODULE_NAME,
        `Failed to read mock case detail for ${caseId}.`,
        err,
      );
      const message = (err as Error).message;
      return Promise.reject(message);
    }
    return caseDetail;
  }

  public async getSuggestedCases(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseDetail[]> {
    const gatewayHelper = new GatewayHelper();
    try {
      return gatewayHelper.getAllCasesMockExtract();
    } catch (err) {
      applicationContext.logger.error(
        MODULE_NAME,
        `Failed to read mock case detail for ${caseId}.`,
        err,
      );
      const message = (err as Error).message;
      return Promise.reject(message);
    }
  }

  public async getUpdatedCaseIds(
    _applicationContext: ApplicationContext,
    _start: string,
  ): Promise<string[]> {
    throw new Error('Not implemented');
  }

  searchCases(
    _applicationContext: ApplicationContext,
    searchPredicate: CasesSearchPredicate,
  ): Promise<CaseBasics[]> {
    throw new CamsError(MODULE_NAME, {
      message: `Not implemented for searchCases: ${searchPredicate}`,
    });
  }
}
