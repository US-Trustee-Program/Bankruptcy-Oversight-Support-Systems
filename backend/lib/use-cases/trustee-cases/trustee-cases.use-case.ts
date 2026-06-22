import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { CamsPaginationResponse } from '../../use-cases/gateways.types';
import { TrusteeCasesSearchPredicate } from '@common/api/search';

const MODULE_NAME = 'TRUSTEE-CASES-USE-CASE';

export class TrusteeCasesUseCase {
  public async getCasesForTrustee(
    context: ApplicationContext,
    trusteeId: string,
    predicate: TrusteeCasesSearchPredicate,
  ): Promise<CamsPaginationResponse<TrusteeCaseListItem>> {
    const { limit, offset, caseStatus, chapters, filedDateFrom, filedDateTo } = predicate;
    try {
      const apptRepo = factory.getTrusteeCaseAppointmentsRepository(context);
      const appointments = await apptRepo.getActiveByTrusteeId(trusteeId);

      if (appointments.length === 0) {
        return { data: [], metadata: { total: 0 } };
      }

      const caseIds = appointments.map((a) => a.caseId);
      const casesRepo = factory.getCasesRepository(context);
      const casesResponse = await casesRepo.searchCases({
        caseIds,
        limit: 500,
        offset: 0,
        ...(chapters?.length ? { chapters } : {}),
        ...(caseStatus === 'OPEN' ? { excludeClosedCases: true } : {}),
        ...(caseStatus === 'CLOSED' ? { includeOnlyClosedCases: true } : {}),
        ...(filedDateFrom ? { filedDateFrom } : {}),
        ...(filedDateTo ? { filedDateTo } : {}),
      });
      const syncedCases = casesResponse.data;

      if (syncedCases.length === 500) {
        context.logger.warn(
          MODULE_NAME,
          `Trustee ${trusteeId} may have >500 cases; results may be truncated.`,
        );
      }

      const caseMap = new Map(syncedCases.map((sc) => [sc.caseId, sc]));

      const allItems: TrusteeCaseListItem[] = [];
      for (const appt of appointments) {
        const syncedCase = caseMap.get(appt.caseId);
        if (!syncedCase) continue;
        allItems.push({
          caseId: appt.caseId,
          caseNumber: syncedCase.caseNumber,
          courtDivisionName: syncedCase.courtDivisionName,
          caseTitle: syncedCase.caseTitle,
          chapter: syncedCase.chapter,
          dateFiled: syncedCase.dateFiled,
          appointedDate: appt.appointedDate,
        });
      }

      allItems.sort((a, b) => (a.dateFiled < b.dateFiled ? 1 : -1));

      return {
        data: allItems.slice(offset, offset + limit),
        metadata: { total: allItems.length },
      };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve cases for trustee ${trusteeId}.`,
      });
    }
  }
}
