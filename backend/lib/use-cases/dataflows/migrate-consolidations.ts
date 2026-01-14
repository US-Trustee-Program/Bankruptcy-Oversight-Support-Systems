import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { ConsolidationFrom, ConsolidationTo } from '@common/cams/events';
import { ConsolidationType } from '@common/cams/orders';
import { CaseSummary } from '@common/cams/cases';
import { CaseConsolidationHistory } from '@common/cams/history';
import { ACMS_SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
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

export type AcmsConsolidationMemberCase = {
  caseId: string;
  consolidationType: string;
  consolidationDate: string;
};

export type AcmsConsolidation = {
  leadCaseId: string;
  memberCases: AcmsConsolidationMemberCase[];
};

export type AcmsTransformationResult = {
  leadCaseId: string;
  memberCaseCount: number;
  success: boolean;
  error?: CamsError;
};

class AcmsOrders {
  public async getLeadCaseIds(
    context: ApplicationContext,
    predicate: AcmsPredicate,
  ): Promise<string[]> {
    try {
      const gateway = factory.getAcmsGateway(context);
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
      memberCaseCount: 0,
      success: true,
    };
    try {
      const casesRepo = factory.getCasesRepository(context);
      const dxtr = factory.getCasesGateway(context);
      const acms = factory.getAcmsGateway(context);

      const basics = await acms.getConsolidationDetails(context, acmsLeadCaseId);
      report.leadCaseId = basics.leadCaseId;
      const leadCase = await dxtr.getCaseSummary(context, basics.leadCaseId);

      const existingConsolidations = await casesRepo.getConsolidation(basics.leadCaseId);
      const existingMemberCaseIds = existingConsolidations
        .filter((link) => link.documentType === 'CONSOLIDATION_FROM')
        .map((link) => link.otherCase.caseId)
        .reduce((acc, caseId) => {
          acc.add(caseId);
          return acc;
        }, new Set<string>());

      const exportedMemberCaseIds = basics.memberCases
        .map((bCase) => bCase.caseId)
        .reduce((acc, caseId) => {
          acc.add(caseId);
          return acc;
        }, new Set<string>());

      report.memberCaseCount = exportedMemberCaseIds.size;

      const unimportedMemberCaseIds = new Set<string>();
      exportedMemberCaseIds.forEach((caseId) => {
        if (!existingMemberCaseIds.has(caseId)) {
          unimportedMemberCaseIds.add(caseId);
        }
      });

      // Return early if there is no work to do.
      if (unimportedMemberCaseIds.size === 0) {
        return report;
      }

      // Load any member cases that have not been migrated.
      const memberCaseSummaries = new Map<string, CaseSummary>();
      const filteredBasicsMemberCases = basics.memberCases.filter((bCase) =>
        unimportedMemberCaseIds.has(bCase.caseId),
      );

      for (const memberCase of filteredBasicsMemberCases) {
        const consolidationType = memberCase.consolidationType as ConsolidationType;

        const toLink: ConsolidationTo = {
          caseId: memberCase.caseId,
          consolidationType,
          documentType: 'CONSOLIDATION_TO',
          orderDate: memberCase.consolidationDate,
          otherCase: leadCase,
          updatedBy: ACMS_SYSTEM_USER_REFERENCE,
          updatedOn: memberCase.consolidationDate,
        };

        const otherCase = await dxtr.getCaseSummary(context, memberCase.caseId);
        context.logger.debug(MODULE_NAME, `Found case summary for: ${otherCase.caseId}.`);

        const fromLink: ConsolidationFrom = {
          caseId: basics.leadCaseId,
          consolidationType,
          documentType: 'CONSOLIDATION_FROM',
          orderDate: memberCase.consolidationDate,
          otherCase,
          updatedBy: ACMS_SYSTEM_USER_REFERENCE,
          updatedOn: memberCase.consolidationDate,
        };
        memberCaseSummaries.set(otherCase.caseId, otherCase);

        await casesRepo.createConsolidationFrom(fromLink);
        await casesRepo.createConsolidationTo(toLink);
      }

      // Partition history by date.
      const historyDateMap = new Map<string, CaseSummary[]>();
      filteredBasicsMemberCases.forEach((bCase) => {
        if (historyDateMap.has(bCase.consolidationDate)) {
          historyDateMap.get(bCase.consolidationDate).push(memberCaseSummaries.get(bCase.caseId));
        } else {
          historyDateMap.set(bCase.consolidationDate, [memberCaseSummaries.get(bCase.caseId)]);
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
            memberCases: [...historyDateMap.get(consolidationDate)],
          },
          updatedBy: ACMS_SYSTEM_USER_REFERENCE,
          updatedOn: consolidationDate,
        };

        // Write the history for the member cases.
        const caseIds = [...historyDateMap.get(consolidationDate).map((bCase) => bCase.caseId)];
        for (const caseId of caseIds) {
          const memberCaseHistory = { caseId, ...caseHistory };
          await casesRepo.createCaseHistory(memberCaseHistory);
        }

        // Write the history for the lead case.
        const leadCaseHistoryAfter: CaseConsolidationHistory['after'] = {
          status: 'approved',
          leadCase,
          memberCases: leadCaseHistoryBefore
            ? [...leadCaseHistoryBefore.memberCases, ...historyDateMap.get(consolidationDate)]
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
