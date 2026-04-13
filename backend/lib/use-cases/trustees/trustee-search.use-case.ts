import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeSearchResult } from '@common/cams/trustee-search';
import { Trustee } from '@common/cams/trustees';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { generateStructuredQueryTokens } from '../../adapters/utils/phonetic-helper';

const MODULE_NAME = 'TRUSTEE-SEARCH-USE-CASE';
const MAX_RESULTS = 25;

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

      // Phase 1: Exact regex search
      const exactTrustees = await trusteesRepo.searchTrusteesByName(name);

      // Phase 2: Phonetic token search
      const structured = generateStructuredQueryTokens(name);
      const allTokens = [...structured.searchTokens, ...structured.nicknameTokens];
      let phoneticTrustees: Trustee[] = [];
      if (allTokens.length > 0) {
        phoneticTrustees = await trusteesRepo.searchTrusteesByPhoneticTokens(allTokens);
      }

      // Merge & deduplicate: exact matches first, then phonetic-only
      const exactIds = new Set(exactTrustees.map((t) => t.trusteeId));
      const phoneticOnly = phoneticTrustees.filter((t) => !exactIds.has(t.trusteeId));

      type TaggedTrustee = { trustee: Trustee; matchType: 'exact' | 'phonetic' };
      const merged: TaggedTrustee[] = [
        ...exactTrustees.map((t) => ({ trustee: t, matchType: 'exact' as const })),
        ...phoneticOnly.map((t) => ({ trustee: t, matchType: 'phonetic' as const })),
      ];

      // Cap results
      const capped = merged.slice(0, MAX_RESULTS);

      // Fetch appointments and apply court filter
      const results: TrusteeSearchResult[] = [];
      await Promise.all(
        capped.map(async ({ trustee, matchType }) => {
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
            matchType,
          });
        }),
      );

      // Preserve sort order: exact first, then phonetic
      const exactResults = results.filter((r) => r.matchType === 'exact');
      const phoneticResults = results.filter((r) => r.matchType === 'phonetic');
      const sortedResults = [...exactResults, ...phoneticResults];

      const exactMatchCount = exactResults.length;
      const phoneticMatchCount = phoneticResults.length;

      context.observability.completeTrace(trace, 'TrusteeManualSearchPerformed', {
        success: true,
        properties: {
          searchQuery: name,
          courtIdFilter: courtId ?? 'none',
        },
        measurements: {
          exactMatchCount,
          phoneticMatchCount,
          totalResultCount: sortedResults.length,
        },
      });

      return sortedResults;
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
