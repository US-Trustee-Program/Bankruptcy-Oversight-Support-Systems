import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';
import { ConsolidationFrom, ConsolidationTo } from '../../../../../common/src/cams/events';
import { ConsolidationType } from '../../../../../common/src/cams/orders';
import { CaseSummary } from '../../../../../common/src/cams/cases';
import { CaseConsolidationHistory } from '../../../../../common/src/cams/history';
import { ACMS_SYSTEM_USER_REFERENCE } from '../../../../../common/src/cams/auditable';

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

export type AcmsConsolidationReport = {
  leadCaseId: string;
  success: boolean;
  error?: unknown;
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
  ): Promise<AcmsConsolidationReport> {
    const report: AcmsConsolidationReport = { leadCaseId, success: true };
    try {
      const casesRepo = Factory.getCasesRepository(context);
      const dxtr = Factory.getCasesGateway(context);
      const acms = Factory.getAcmsGateway(context);

      const basics = await acms.getConsolidationDetails(context, leadCaseId);
      const leadCase = await dxtr.getCaseSummary(context, leadCaseId);

      const childCaseSummaries: CaseSummary[] = [];
      for (const childCase of basics.childCases) {
        // NOTE! Azure suggests that all work be IDEMPOTENT because activities run _at least once_.
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
        childCaseSummaries.push(otherCase);

        // TODO: convert these functions to upsert because this _may_ run more than once
        await casesRepo.createConsolidationFrom(fromLink);
        await casesRepo.createConsolidationTo(toLink);
      }

      const caseHistory: Omit<CaseConsolidationHistory, 'caseId'> = {
        documentType: 'AUDIT_CONSOLIDATION',
        before: null,
        after: {
          status: 'approved',
          leadCase,
          childCases: childCaseSummaries,
        },
        updatedBy: ACMS_SYSTEM_USER_REFERENCE,
        updatedOn: basics.childCases[0].consolidationDate,
      };

      // TODO: Consider the case history will be different if the consolidation date is not the same for all child cases.
      const allCaseIds = [leadCaseId, ...basics.childCases.map((bCase) => bCase.caseId)];
      for (const caseId of allCaseIds) {
        await casesRepo.createCaseHistory({ ...caseHistory, caseId });
      }
    } catch (error) {
      report.success = false;
      report.error = error;
    }
    return report;
  }
}

export default AcmsOrders;
