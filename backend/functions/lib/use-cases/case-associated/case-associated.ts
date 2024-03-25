import { getCasesRepository } from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { CasesRepository } from '../gateways.types';
import { EventCaseReference } from '../../../../../common/src/cams/events';

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

    if (consolidation.length === 1) {
      // Assume this condition is a child case.
      leadCaseRef = consolidation[0];
      const leadCaseId = leadCaseRef.otherCase.caseId;
      childCaseRefs = await this.casesRepository.getConsolidation(context, leadCaseId);
    } else {
      // Assume this condition is the lead case.
      childCaseRefs = consolidation;
      const leadCaseId = childCaseRefs[0].otherCase.caseId;
      const childCaseConsolidation = await this.casesRepository.getConsolidation(
        context,
        leadCaseId,
      );
      leadCaseRef = childCaseConsolidation[0];
    }
    return [leadCaseRef, ...childCaseRefs];
  }
}
