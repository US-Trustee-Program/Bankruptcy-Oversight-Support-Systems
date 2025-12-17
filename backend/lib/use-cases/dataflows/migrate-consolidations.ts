import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';
import { ConsolidationFrom, ConsolidationTo } from '../../../../common/src/cams/events';
import { ConsolidationType } from '../../../../common/src/cams/orders';
import { CaseSummary } from '../../../../common/src/cams/cases';
import { CaseConsolidationHistory } from '../../../../common/src/cams/history';
import { ACMS_SYSTEM_USER_REFERENCE } from '../../../../common/src/cams/auditable';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsError } from '../../common-errors/cams-error';

const MODULE_NAME = 'ACMS-ORDERS-USE-CASE';

export type AcmsBounds = {
  divisionCodes: string[];
  chapters: string[];
};

export type AcmsPredicate = {
  divisionCode: string;
  chapter: string;
};

export type AcmsEtlQueueItem = AcmsPredicate & {
  leadCaseId: string;
};

export function isAcmsEtlQueueItem(item: unknown): item is AcmsEtlQueueItem {
  return typeof item === 'object' && item !== null && 'leadCaseId' in item;
}

export type AcmsConsolidationChildCase = {
  caseId: string;
  consolidationType: string;
  consolidationDate: string;
};

export type AcmsConsolidation = {
  leadCaseId: string;
  childCases: AcmsConsolidationChildCase[];
};

export type AcmsTransformationResult = {
  leadCaseId: string;
  childCaseCount: number;
  success: boolean;
  error?: CamsError;
};

class AcmsOrders {
  public async getLeadCaseIds(
    context: ApplicationContext,
    predicate: AcmsPredicate,
  ): Promise<string[]> {
    try {
      const gateway = Factory.getAcmsGateway(context);
      const leadCaseIds = await gateway.getLeadCaseIds(context, predicate);
      context.logger.debug(
        MODULE_NAME,
        `Found ${leadCaseIds.length} lead cases for ${predicate.chapter}:${predicate.divisionCode}.`,
        leadCaseIds,
      );
      return leadCaseIds;
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        'Failed to get lead case ids from the ACMS gateway.',
      );
    }
  }

  public async migrateConsolidation(
    context: ApplicationContext,
    acmsLeadCaseId: string,
  ): Promise<AcmsTransformationResult> {
    const report: AcmsTransformationResult = {
      leadCaseId: acmsLeadCaseId,
      childCaseCount: 0,
      success: true,
    };
    try {
      const casesRepo = Factory.getCasesRepository(context);
      const dxtr = Factory.getCasesGateway(context);
      const acms = Factory.getAcmsGateway(context);

      const basics = await acms.getConsolidationDetails(context, acmsLeadCaseId);
      report.leadCaseId = basics.leadCaseId;
      const leadCase = await dxtr.getCaseSummary(context, basics.leadCaseId);

      const existingConsolidations = await casesRepo.getConsolidation(basics.leadCaseId);
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

      report.childCaseCount = exportedChildCaseIds.size;

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
          updatedBy: ACMS_SYSTEM_USER_REFERENCE,
          updatedOn: childCase.consolidationDate,
        };

        const otherCase = await dxtr.getCaseSummary(context, childCase.caseId);
        context.logger.debug(MODULE_NAME, `Found case summary for: ${otherCase.caseId}.`);

        const fromLink: ConsolidationFrom = {
          caseId: basics.leadCaseId,
          consolidationType,
          documentType: 'CONSOLIDATION_FROM',
          orderDate: childCase.consolidationDate,
          otherCase,
          updatedBy: ACMS_SYSTEM_USER_REFERENCE,
          updatedOn: childCase.consolidationDate,
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

      return report;
    } catch (error) {
      report.success = false;
      report.error = getCamsError(
        error,
        MODULE_NAME,
        `Transformation failed for lead case ${acmsLeadCaseId}. ${error.message}`,
      );
      context.logger.camsError(report.error);
    }
    return report;
  }
}

export default AcmsOrders;
