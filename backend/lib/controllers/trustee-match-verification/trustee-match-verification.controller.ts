import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import factory from '../../factory';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { TrusteeMatchVerificationUseCase } from '../../use-cases/trustee-match-verification/trustee-match-verification.use-case';
import HttpStatusCodes from '@common/api/http-status-codes';

const MODULE_NAME = 'TRUSTEE-MATCH-VERIFICATION-CONTROLLER';

export class TrusteeMatchVerificationController {
  async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeMatchVerification[] | undefined>> {
    if (!context.featureFlags['trustee-verification-enabled']) {
      return { statusCode: 404 };
    }

    try {
      if (context.request.method === 'GET') {
        return await this.getVerificationOrders(context);
      } else if (context.request.method === 'PATCH') {
        return await this.approveVerification(context);
      }
      throw new BadRequestError(MODULE_NAME, { message: 'Unsupported method.' });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  private async getVerificationOrders(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeMatchVerification[]>> {
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
  }

  private async approveVerification(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<undefined>> {
    const id = context.request.params['id'];
    if (!id) {
      throw new BadRequestError(MODULE_NAME, { message: 'Missing verification ID.' });
    }
    const body = context.request.body as { resolvedTrusteeId?: string };
    if (!body?.resolvedTrusteeId) {
      throw new BadRequestError(MODULE_NAME, { message: 'Missing resolvedTrusteeId.' });
    }
    const useCase = new TrusteeMatchVerificationUseCase();
    await useCase.approveVerification(context, id, body.resolvedTrusteeId);
    return httpSuccess({ statusCode: HttpStatusCodes.NO_CONTENT });
  }
}
