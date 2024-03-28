import { getCasesRepository } from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { CasesRepository } from '../gateways.types';
import { EventCaseReference } from '../../../../../common/src/cams/events';

function getEarliestDate(orders: Array<EventCaseReference>) {
  const earliestOrder = orders.sort((a, b) => (a.orderDate < b.orderDate ? -1 : 1))[0];
  const earliestOrderDate = earliestOrder.orderDate;
  return earliestOrderDate;
}

export class CaseAssociatedUseCase {
  private casesRepository: CasesRepository;

  constructor(applicationContext: ApplicationContext) {
    this.casesRepository = getCasesRepository(applicationContext);
  }

  public async getAssociatedCases(
    context: ApplicationContext,
    caseId: string,
  ): Promise<EventCaseReference[]> {
    const consolidation = await this.casesRepository.getConsolidation(context, caseId);
    if (!consolidation.length) return [];

    let leadCaseRef: EventCaseReference;
    let childCaseRefs: Array<EventCaseReference>;

    const thisIsTheLeadCase =
      consolidation.length > 1 || consolidation[0].documentType === 'CONSOLIDATION_FROM';

    if (thisIsTheLeadCase) {
      childCaseRefs = consolidation;
      const leadCaseId = childCaseRefs[0].otherCase.caseId;
      const childCaseConsolidation = await this.casesRepository.getConsolidation(
        context,
        leadCaseId,
      );
      leadCaseRef = childCaseConsolidation[0];
    } else {
      leadCaseRef = consolidation[0];
      const leadCaseId = leadCaseRef.otherCase.caseId;
      childCaseRefs = await this.casesRepository.getConsolidation(context, leadCaseId);
    }
    leadCaseRef.orderDate = getEarliestDate(childCaseRefs);
    return [leadCaseRef, ...childCaseRefs];
  }
}
