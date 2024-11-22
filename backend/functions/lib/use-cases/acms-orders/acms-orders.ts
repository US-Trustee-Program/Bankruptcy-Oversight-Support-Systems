import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';
import { ConsolidationFrom, ConsolidationTo } from '../../../../../common/src/cams/events';
import { ConsolidationType } from '../../../../../common/src/cams/orders';
import { CaseSummary } from '../../../../../common/src/cams/cases';
import { CaseConsolidationHistory } from '../../../../../common/src/cams/history';
import { ACMS_SYSTEM_USER_REFERENCE } from '../../../../../common/src/cams/auditable';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'ACMS_ORDERS_USE_CASE';

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
    // TODO: Add child case count to the report??
    const report: AcmsConsolidationReport = { leadCaseId, success: true };
    try {
      const casesRepo = Factory.getCasesRepository(context);
      const dxtr = Factory.getCasesGateway(context);
      const acms = Factory.getAcmsGateway(context);

      const basics = await acms.getConsolidationDetails(context, leadCaseId);
      const leadCase = await dxtr.getCaseSummary(context, leadCaseId);

      // NOTE! Azure suggests that all work be IDEMPOTENT because activities run _at least once_.
      // Check if exported child cases have already been migrated.
      const existingConsolidations = await casesRepo.getConsolidation(leadCaseId);
      const existingChildCaseIds = existingConsolidations
        .filter((link) => link.documentType === 'CONSOLIDATION_FROM')
        .map((link) => link.otherCase.caseId)
        .reduce((acc, caseId) => {
          acc.add(caseId);
          return acc;
        }, new Set<string>());

      const exportedChildCaseIds = basics.childCases
        .map((bCase) => bCase.caseId)
        .reduce((acc, caseId) => {
          acc.add(caseId);
          return acc;
        }, new Set<string>());

      const unimportedChildCaseIds = new Set<string>();
      exportedChildCaseIds.forEach((caseId) => {
        if (!existingChildCaseIds.has(caseId)) {
          unimportedChildCaseIds.add(caseId);
        }
      });

      // Return early if there is no work to do.
      if (unimportedChildCaseIds.size === 0) {
        return report;
      }

      // Load any child cases that have not been migrated.
      const childCaseSummaries = new Map<string, CaseSummary>();
      const filteredBasicsChildCases = basics.childCases.filter((bCase) =>
        unimportedChildCaseIds.has(bCase.caseId),
      );

      for (const childCase of filteredBasicsChildCases) {
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
        childCaseSummaries.set(otherCase.caseId, otherCase);

        await casesRepo.createConsolidationFrom(fromLink);
        await casesRepo.createConsolidationTo(toLink);
      }

      // Partition history by date.
      const historyDateMap = new Map<string, CaseSummary[]>();
      filteredBasicsChildCases.forEach((bCase) => {
        if (historyDateMap.has(bCase.consolidationDate)) {
          historyDateMap.get(bCase.consolidationDate).push(childCaseSummaries.get(bCase.caseId));
        } else {
          historyDateMap.set(bCase.consolidationDate, [childCaseSummaries.get(bCase.caseId)]);
        }
      });

      const consolidationDates = Array.from(historyDateMap.keys()).sort();
      let leadCaseHistoryBefore: CaseConsolidationHistory['before'] | null = null;
      for (const consolidationDate of consolidationDates) {
        const caseHistory: Omit<CaseConsolidationHistory, 'caseId'> = {
          documentType: 'AUDIT_CONSOLIDATION',
          before: null,
          after: {
            status: 'approved',
            leadCase,
            childCases: [...historyDateMap.get(consolidationDate)],
          },
          updatedBy: ACMS_SYSTEM_USER_REFERENCE,
          updatedOn: consolidationDate,
        };

        // Write the history for the child cases.
        const caseIds = [...historyDateMap.get(consolidationDate).map((bCase) => bCase.caseId)];
        for (const caseId of caseIds) {
          const childCaseHistory = { caseId, ...caseHistory };
          await casesRepo.createCaseHistory(childCaseHistory);
        }

        // Write the history for the lead case.
        const leadCaseHistoryAfter: CaseConsolidationHistory['after'] = {
          status: 'approved',
          leadCase,
          childCases: leadCaseHistoryBefore
            ? [...leadCaseHistoryBefore.childCases, ...historyDateMap.get(consolidationDate)]
            : [...historyDateMap.get(consolidationDate)],
        };
        const leadCaseHistory: CaseConsolidationHistory = {
          caseId: leadCase.caseId,
          ...caseHistory,
          before: leadCaseHistoryBefore ? { ...leadCaseHistoryBefore } : null,
          after: leadCaseHistoryAfter,
        };
        await casesRepo.createCaseHistory(leadCaseHistory);
        leadCaseHistoryBefore = leadCaseHistoryAfter;
      }
    } catch (error) {
      report.success = false;
      const camsError = getCamsError(
        error,
        MODULE_NAME,
        `Transformation failed for lead case ${leadCaseId}`,
      );
      context.logger.camsError(camsError);
    }
    return report;
  }
}

export default AcmsOrders;
