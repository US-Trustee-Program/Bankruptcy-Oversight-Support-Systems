import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeCaseListItem } from '@common/cams/trustee-cases';
import { CamsPaginationResponse } from '../gateways.types';
import { PaginationParameters } from '@common/api/pagination';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'TRUSTEE-CASES-USE-CASE';

export class TrusteeCasesUseCase {
  async getCasesForTrustee(
    context: ApplicationContext,
    trusteeId: string,
    predicate: PaginationParameters,
  ): Promise<CamsPaginationResponse<TrusteeCaseListItem>> {
    try {
      const repo = factory.getTrusteeAppointmentsRepository(context);
      return await repo.getCasesForTrustee(trusteeId, predicate);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
