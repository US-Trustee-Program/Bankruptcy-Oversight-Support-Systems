import { ACMS_SYSTEM_USER_REFERENCE } from '../../../../common/src/cams/auditable';
import { CaseSummary } from '../../../../common/src/cams/cases';
import { ConsolidationFrom, ConsolidationTo } from '../../../../common/src/cams/events';
import { CaseConsolidationHistory } from '../../../../common/src/cams/history';
import { ConsolidationType } from '../../../../common/src/cams/orders';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsError } from '../../common-errors/error-utilities';
import Factory from '../../factory';

const MODULE_NAME = 'ACMS-ORDERS-USE-CASE';

export type AcmsBounds = {
  chapters: string[];
  divisionCodes: string[];
};

export type AcmsConsolidation = {
  childCases: AcmsConsolidationChildCase[];
  leadCaseId: string;
};

export type AcmsConsolidationChildCase = {
  caseId: string;
  consolidationDate: string;
  consolidationType: string;
};

export type AcmsEtlQueueItem = AcmsPredicate & {
  leadCaseId: string;
};

export type AcmsPredicate = {
  chapter: string;
  divisionCode: string;
};

export type AcmsTransformationResult = {
  childCaseCount: number;
  error?: CamsError;
  leadCaseId: string;
  success: boolean;
};

export type TriggerRequest = AcmsBounds;

export class AcmsOrders {
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
      childCaseCount: 0,
      leadCaseId: acmsLeadCaseId,
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
        if (otherCase) {
          context.logger.debug(MODULE_NAME, `Found case summary for: ${otherCase.caseId}.`);
        }
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
          after: {
            childCases: [...historyDateMap.get(consolidationDate)],
            leadCase,
            status: 'approved',
          },
          before: null,
          documentType: 'AUDIT_CONSOLIDATION',
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
          childCases: leadCaseHistoryBefore
            ? [...leadCaseHistoryBefore.childCases, ...historyDateMap.get(consolidationDate)]
            : [...historyDateMap.get(consolidationDate)],
          leadCase,
          status: 'approved',
        };
        const leadCaseHistory: CaseConsolidationHistory = {
          caseId: leadCase.caseId,
          ...caseHistory,
          after: leadCaseHistoryAfter,
          before: leadCaseHistoryBefore ? { ...leadCaseHistoryBefore } : null,
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

export function isAcmsEtlQueueItem(item: unknown): item is AcmsEtlQueueItem {
  return typeof item === 'object' && 'leadCaseId' in item;
}

export default AcmsOrders;
