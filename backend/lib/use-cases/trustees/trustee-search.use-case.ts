import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeSearchResult } from '@common/cams/trustee-search';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'TRUSTEE-SEARCH-USE-CASE';
const MAX_RESULTS = 25;

export class TrusteeSearchUseCase {
  async searchTrustees(context: ApplicationContext, name: string): Promise<TrusteeSearchResult[]> {
    const trace = context.observability.startTrace(context.invocationId);

    try {
      const trusteesRepo = factory.getTrusteesRepository(context);
      const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

      const trustees = await trusteesRepo.searchTrusteesByName(name);
      const capped = trustees.slice(0, MAX_RESULTS);

      const results = await Promise.all(
        capped.map(async (trustee) => {
          const appointments = await appointmentsRepo.getTrusteeAppointments(trustee.trusteeId);
          return {
            trusteeId: trustee.trusteeId,
            name: trustee.name,
            address: trustee.public.address,
            phone: trustee.public.phone,
            email: trustee.public.email,
            appointments,
          };
        }),
      );

      context.observability.completeTrace(trace, 'TrusteeManualSearchPerformed', {
        success: true,
        properties: {
          searchQuery: name,
        },
        measurements: {
          resultCount: results.length,
        },
      });

      return results;
    } catch (originalError) {
      context.observability.completeTrace(trace, 'TrusteeManualSearchPerformed', {
        success: false,
        properties: {
          searchQuery: name,
        },
        measurements: {},
      });
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
