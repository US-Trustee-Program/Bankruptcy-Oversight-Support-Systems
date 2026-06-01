import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';

const MODULE_NAME = 'TRUSTEE-CASES-USE-CASE';

export class TrusteeCasesUseCase {
  public async getCasesForTrustee(
    context: ApplicationContext,
    trusteeId: string,
  ): Promise<TrusteeCaseListItem[]> {
    try {
      const apptRepo = factory.getTrusteeAppointmentsRepository(context);
      const appointments = await apptRepo.getActiveCaseAppointmentsByTrusteeId(trusteeId);

      if (appointments.length === 0) {
        return [];
      }

      const caseIds = appointments.map((a) => a.caseId);
      const casesRepo = factory.getCasesRepository(context);
      const casesResponse = await casesRepo.searchCases({ caseIds, limit: 500, offset: 0 });
      const syncedCases = casesResponse.data;

      const caseMap = new Map(syncedCases.map((sc) => [sc.caseId, sc]));

      const items: TrusteeCaseListItem[] = [];
      for (const appt of appointments) {
        const syncedCase = caseMap.get(appt.caseId);
        if (!syncedCase) continue;
        items.push({
          caseId: appt.caseId,
          caseNumber: syncedCase.caseNumber,
          chapter: syncedCase.chapter,
          dateFiled: syncedCase.dateFiled,
          appointedDate: appt.assignedOn,
        });
      }

      items.sort((a, b) => (a.dateFiled < b.dateFiled ? 1 : -1));

      return items;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve cases for trustee ${trusteeId}.`,
      });
    }
  }
}
