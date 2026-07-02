import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';
import { CamsPaginationResponse } from '../../use-cases/gateways.types';
import { TrusteeCasesSearchPredicate } from '@common/api/search';

export class TrusteeCasesUseCase {
  public async getCasesForTrustee(
    context: ApplicationContext,
    trusteeId: string,
    predicate: TrusteeCasesSearchPredicate,
  ): Promise<CamsPaginationResponse<TrusteeCaseListItem>> {
    const apptRepo = factory.getTrusteeCaseAppointmentsRepository(context);
    return apptRepo.getCasesForTrustee(trusteeId, predicate);
  }
}
