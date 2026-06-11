import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeSearchResult } from '@common/cams/trustee-search';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'TRUSTEE-SEARCH-OPTIMIZED-USE-CASE';

export class TrusteeSearchOptimizedUseCase {
  async searchTrustees(
    context: ApplicationContext,
    name: string,
    courtId?: string,
  ): Promise<TrusteeSearchResult[]> {
    const trace = context.observability.startTrace(context.invocationId);

    try {
      const trusteesRepo = factory.getTrusteesRepository(context);
      const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

      const trustees = await trusteesRepo.searchTrusteesByNameScoredOptimized(name);

      const results: TrusteeSearchResult[] = [];
      await Promise.all(
        trustees.map(async (trustee) => {
          const appointments = await appointmentsRepo.getTrusteeAppointments(trustee.trusteeId);
          if (courtId && !appointments.some((appt) => appt.courtId === courtId)) {
            return;
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
        }),
      );

      const trusteeOrder = new Map(trustees.map((t, i) => [t.trusteeId, i]));
      results.sort(
        (a, b) => (trusteeOrder.get(a.trusteeId) ?? 0) - (trusteeOrder.get(b.trusteeId) ?? 0),
      );

      context.observability.completeTrace(trace, 'TrusteeManualSearchOptimizedPerformed', {
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
      context.observability.completeTrace(trace, 'TrusteeManualSearchOptimizedPerformed', {
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
