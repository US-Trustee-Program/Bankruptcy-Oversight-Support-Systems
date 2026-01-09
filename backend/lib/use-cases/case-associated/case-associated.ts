import Factory from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { EventCaseReference } from '@common/cams/events';

function getEarliestDate(orders: Array<EventCaseReference>) {
  const earliestOrder = [...orders].sort((a, b) => (a.orderDate < b.orderDate ? -1 : 1))[0];
  return earliestOrder.orderDate;
}

export class CaseAssociatedUseCase {
  public async getAssociatedCases(context: ApplicationContext): Promise<EventCaseReference[]> {
    const casesRepo = Factory.getCasesRepository(context);
    const caseId = context.request.params.caseId;
    const consolidation = await casesRepo.getConsolidation(caseId);
    if (!consolidation.length) return [];

    let leadCaseRef: EventCaseReference;
    let memberCaseRefs: Array<EventCaseReference>;

    const thisIsTheLeadCase =
      consolidation.length > 1 || consolidation[0].documentType === 'CONSOLIDATION_FROM';

    if (thisIsTheLeadCase) {
      memberCaseRefs = consolidation;
      const leadCaseId = memberCaseRefs[0].otherCase.caseId;
      const memberCaseConsolidation = await casesRepo.getConsolidation(leadCaseId);
      leadCaseRef = memberCaseConsolidation[0];
    } else {
      leadCaseRef = consolidation[0];
      const leadCaseId = leadCaseRef.otherCase.caseId;
      memberCaseRefs = await casesRepo.getConsolidation(leadCaseId);
    }
    leadCaseRef.orderDate = getEarliestDate(memberCaseRefs);
    return [leadCaseRef, ...memberCaseRefs];
  }
}
