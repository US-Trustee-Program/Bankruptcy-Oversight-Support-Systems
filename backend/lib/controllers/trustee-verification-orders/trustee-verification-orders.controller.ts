import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import factory from '../../factory';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';

const MODULE_NAME = 'TRUSTEE-VERIFICATION-ORDERS-CONTROLLER';

export class TrusteeVerificationOrdersController {
  constructor(private readonly context: ApplicationContext) {}

  async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeMatchVerification[]>> {
    try {
      const repo = factory.getTrusteeMatchVerificationRepository(context);
      const data = await repo.search();

      const trusteesRepo = factory.getTrusteesRepository(context);
      const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

      const enriched = await Promise.all(
        data.map(async (verification) => {
          const enrichedCandidates = await Promise.all(
            verification.matchCandidates.map(async (candidate) => {
              try {
                const [trustee, appointments] = await Promise.all([
                  trusteesRepo.read(candidate.trusteeId),
                  appointmentsRepo.getTrusteeAppointments(candidate.trusteeId),
                ]);
                return {
                  ...candidate,
                  address: trustee.public.address,
                  phone: trustee.public.phone,
                  email: trustee.public.email,
                  appointments,
                };
              } catch {
                return candidate;
              }
            }),
          );
          return { ...verification, matchCandidates: enrichedCandidates };
        }),
      );

      return httpSuccess({
        body: {
          meta: { self: context.request.url },
          data: enriched,
        },
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
