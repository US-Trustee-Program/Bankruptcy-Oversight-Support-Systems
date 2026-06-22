import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeSearchResult } from '@common/cams/trustee-search';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'TRUSTEE-SEARCH-USE-CASE';

export class TrusteeSearchUseCase {
  async searchTrustees(
    context: ApplicationContext,
    name: string,
    courtId?: string,
  ): Promise<TrusteeSearchResult[]> {
    const trace = context.observability.startTrace(context.invocationId);

    try {
      const trusteesRepo = factory.getTrusteesRepository(context);
      const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

      const trustees = await trusteesRepo.searchTrusteesByNameScored(name);

      const trusteeIds = trustees.map((t) => t.trusteeId);
      const allAppointments = await appointmentsRepo.getAppointmentsByTrusteeIds(trusteeIds);

      const appointmentsByTrustee = new Map<string, typeof allAppointments>();
      for (const appt of allAppointments) {
        const list = appointmentsByTrustee.get(appt.trusteeId) ?? [];
        list.push(appt);
        appointmentsByTrustee.set(appt.trusteeId, list);
      }

      const results: TrusteeSearchResult[] = [];
      for (const trustee of trustees) {
        const appointments = appointmentsByTrustee.get(trustee.trusteeId) ?? [];
        if (courtId && !appointments.some((appt) => appt.courtId === courtId)) {
          continue;
        }
        results.push({
          trusteeId: trustee.trusteeId,
          name: trustee.name,
          address: trustee.public.address,
          phone: trustee.public.phone,
          email: trustee.public.email,
          appointments,
          matchType: 'phonetic',
        });
      }

      context.observability.completeTrace(trace, 'TrusteeManualSearchPerformed', {
        success: true,
        properties: {
          searchQuery: name,
          courtIdFilter: courtId ?? 'none',
        },
        measurements: {
          totalResultCount: results.length,
        },
      });

      return results;
    } catch (originalError) {
      context.observability.completeTrace(trace, 'TrusteeManualSearchPerformed', {
        success: false,
        properties: {
          searchQuery: name,
          courtIdFilter: courtId ?? 'none',
        },
        measurements: {},
      });
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
