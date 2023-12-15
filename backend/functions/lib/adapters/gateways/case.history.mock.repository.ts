/* eslint-disable @typescript-eslint/no-unused-vars */
import { NotFoundError } from '../../common-errors/not-found-error';
import { CaseAssignmentHistory } from '../types/case.assignment';
import { ApplicationContext } from '../types/basic';
import { CaseHistoryGateway } from '../../use-cases/gateways.types';
import { GatewayHelper } from './gateway-helper';

const MODULENAME = 'CASE-HISTORY-MOCK-GATEWAY';

export const NORMAL_CASE_ID = '111-11-11111';
export const ERROR_CASE_ID = '000-00-00000';

export class MockCaseHistoryCosmosDbRepository implements CaseHistoryGateway {
  async getCaseAssignmentHistory(
    _context: ApplicationContext,
    caseId: string,
  ): Promise<CaseAssignmentHistory[]> {
    const gatewayHelper = new GatewayHelper();
    if (caseId === ERROR_CASE_ID) {
      return Promise.reject(new NotFoundError(MODULENAME, { data: { caseId } }));
    }
    return Promise.resolve(gatewayHelper.getCaseHistoryMockExtract());
  }
}
