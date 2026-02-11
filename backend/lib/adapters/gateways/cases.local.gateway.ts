import {
  CasesInterface,
  TransactionIdRangeForDate,
  UpdatedCaseIds,
} from '../../use-cases/cases/cases.interface';
import { ApplicationContext } from '../types/basic';
import { GatewayHelper } from './gateway-helper';
import { getMonthDayYearStringFromDate } from '../utils/date-helper';
import { CaseBasics, CaseDetail } from '@common/cams/cases';
import { CamsError } from '../../common-errors/cams-error';
import { CasesSearchPredicate } from '@common/api/search';
import MockData from '@common/cams/test-utilities/mock-data';
import { filterToExtendedAscii } from '@common/cams/sanitization';

const MODULE_NAME = 'MOCK-CASES-GATEWAY';

export class CasesLocalGateway implements CasesInterface {
  searchCases(
    _applicationContext: ApplicationContext,
    searchPredicate: CasesSearchPredicate,
  ): Promise<CaseBasics[]> {
    throw new CamsError(MODULE_NAME, {
      message: `Not implemented for searchCases: ${searchPredicate}`,
    });
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
        `Failed to read mock case detail for ${filterToExtendedAscii(caseId)}.`,
        err,
      );
      const { message } = err as Error;
      return Promise.reject(message);
    }
    return caseDetail;
  }

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
    casesStart: string,
    transactionsStart: string,
  ): Promise<UpdatedCaseIds> {
    return {
      caseIds: [],
      latestCasesSyncDate: casesStart,
      latestTransactionsSyncDate: transactionsStart,
    };
  }

  public async getCasesWithTerminalTransactionBlindSpot(
    _context: ApplicationContext,
    _cutoffDate: string,
  ): Promise<string[]> {
    throw new Error('Not implemented');
  }

  public async findTransactionIdRangeForDate(
    _context: ApplicationContext,
    _findDate: string,
  ): Promise<TransactionIdRangeForDate> {
    throw new Error('Not implemented');
  }

  public async findMaxTransactionId(_context: ApplicationContext): Promise<string> {
    throw new Error('Not implemented');
  }
}
