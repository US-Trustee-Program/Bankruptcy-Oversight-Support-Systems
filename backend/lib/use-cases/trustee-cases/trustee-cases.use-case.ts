import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { CamsPaginationResponse } from '../../use-cases/gateways.types';

const MODULE_NAME = 'TRUSTEE-CASES-USE-CASE';

export class TrusteeCasesUseCase {
  public async getCasesForTrustee(
    context: ApplicationContext,
    trusteeId: string,
    limit: number,
    offset: number,
  ): Promise<CamsPaginationResponse<TrusteeCaseListItem>> {
    try {
      const apptRepo = factory.getTrusteeAppointmentsRepository(context);
      const appointments = await apptRepo.getActiveCaseAppointmentsByTrusteeId(trusteeId);

      if (appointments.length === 0) {
        return { data: [], metadata: { total: 0 } };
      }

      const caseIds = appointments.map((a) => a.caseId);
      const casesRepo = factory.getCasesRepository(context);
      const casesResponse = await casesRepo.searchCases({ caseIds, limit: 500, offset: 0 });
      const syncedCases = casesResponse.data;

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
          appointedDate: appt.assignedOn,
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
