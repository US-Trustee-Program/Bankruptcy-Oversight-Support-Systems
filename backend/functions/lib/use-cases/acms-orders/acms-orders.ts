import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';
import { ConsolidationFrom, ConsolidationTo } from '../../../../../common/src/cams/events';
import { ConsolidationType } from '../../../../../common/src/cams/orders';

const _MODULE_NAME = 'ACMS_ORDERS_USE_CASE';

export type Bounds = {
  divisionCodes: string[];
  chapters: string[];
};

export type Predicate = {
  divisionCode: string;
  chapter: string;
};

export type PredicateAndPage = Predicate & {
  pageNumber: number;
};

export type AcmsConsolidationChildCase = {
  caseId: string;
  consolidationType: string;
  consolidationDate: string;
};

export type AcmsConsolidation = {
  leadCaseId: string;
  childCases: AcmsConsolidationChildCase[];
};

export class AcmsOrders {
  public async getPageCount(context: ApplicationContext, predicate: Predicate): Promise<number> {
    const gateway = Factory.getAcmsGateway(context);
    return gateway.getPageCount(context, predicate);
  }

  public async getLeadCaseIds(
    context: ApplicationContext,
    predicateAndPage: PredicateAndPage,
  ): Promise<string[]> {
    const gateway = Factory.getAcmsGateway(context);
    return gateway.getLeadCaseIds(context, predicateAndPage);
  }

  public async migrateConsolidation(
    context: ApplicationContext,
    leadCaseId: string,
  ): Promise<void> {
    // NOTE! Azure suggests that all work be IDEMPOTENT because activities run _at least once_.

    const casesRepo = Factory.getCasesRepository(context);
    const dxtr = Factory.getCasesGateway(context);
    const acms = Factory.getAcmsGateway(context);
    const basics = await acms.getConsolidationDetails(context, leadCaseId);

    // TODO: Consider if there is a better way to get the order date.
    const _orderDate = basics.childCases[0].consolidationDate;

    const leadCase = await dxtr.getCaseSummary(context, leadCaseId);

    for (const childCase of basics.childCases) {
      const consolidationType = childCase.consolidationType as ConsolidationType;

      const toLink: ConsolidationTo = {
        caseId: childCase.caseId,
        consolidationType,
        documentType: 'CONSOLIDATION_TO',
        orderDate: childCase.consolidationDate,
        otherCase: leadCase,
      };

      const otherCase = await dxtr.getCaseSummary(context, childCase.caseId);
      const fromLink: ConsolidationFrom = {
        caseId: leadCaseId,
        consolidationType,
        documentType: 'CONSOLIDATION_FROM',
        orderDate: childCase.consolidationDate,
        otherCase,
      };

      await casesRepo.createConsolidationFrom(fromLink);
      await casesRepo.createConsolidationTo(toLink);

      // TODO: Write the audit record to the cases repo too.
    }
  }
}

export default AcmsOrders;
