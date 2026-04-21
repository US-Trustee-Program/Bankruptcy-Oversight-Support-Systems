import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import factory from '../../factory';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { TrusteeMatchVerificationUseCase } from '../../use-cases/trustee-match-verification/trustee-match-verification.use-case';
import HttpStatusCodes from '@common/api/http-status-codes';
import { CamsRole } from '@common/cams/roles';
import { CourtsUseCase } from '../../use-cases/courts/courts';
import { CourtDivisionDetails } from '@common/cams/courts';
import { getCaseIdParts } from '@common/cams/cases';

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
        return await this.handlePatch(context);
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
    const courts = await new CourtsUseCase().getCourts(context);

    const enriched = await Promise.all(
      data.map((verification) =>
        this.enrichVerification(verification, trusteesRepo, appointmentsRepo, courts),
      ),
    );

    return httpSuccess({
      body: {
        meta: { self: context.request.url },
        data: enriched,
      },
    });
  }

  private async enrichVerification(
    verification: TrusteeMatchVerification,
    trusteesRepo: ReturnType<typeof factory.getTrusteesRepository>,
    appointmentsRepo: ReturnType<typeof factory.getTrusteeAppointmentsRepository>,
    courts: CourtDivisionDetails[],
  ): Promise<TrusteeMatchVerification> {
    const enrichedCandidates = await Promise.all(
      verification.matchCandidates.map(async (candidate) => {
        try {
          const [trustee, appointments] = await Promise.all([
            trusteesRepo.read(candidate.trusteeId),
            appointmentsRepo.getTrusteeAppointments(candidate.trusteeId),
          ]);
          const enrichedAppointments = appointments.map((appt) => {
            const court = this.findCourt(courts, appt.divisionCode, appt.courtId);
            return {
              ...appt,
              courtName: court?.courtName,
              courtDivisionName: court?.courtDivisionName,
            };
          });
          return {
            ...candidate,
            address: trustee.public.address,
            phone: trustee.public.phone,
            email: trustee.public.email,
            appointments: enrichedAppointments,
          };
        } catch {
          return candidate;
        }
      }),
    );

    const resolvedTrusteeName = await this.resolveManualTrusteeName(
      verification,
      trusteesRepo,
      enrichedCandidates,
    );

    const courtName = this.resolveCourtName(verification, courts) ?? verification.courtName;

    return {
      ...verification,
      matchCandidates: enrichedCandidates,
      resolvedTrusteeName,
      courtName,
    };
  }

  private async resolveManualTrusteeName(
    verification: TrusteeMatchVerification,
    trusteesRepo: ReturnType<typeof factory.getTrusteesRepository>,
    enrichedCandidates: Array<{ trusteeId: string }>,
  ): Promise<string | undefined> {
    // For approved records where the resolved trustee was manually selected (not a candidate),
    // fetch their name so the UI can display it instead of the raw trustee ID.
    let resolvedTrusteeName = verification.resolvedTrusteeName;
    const isApprovedWithUnresolvedName =
      verification.status === 'approved' && verification.resolvedTrusteeId && !resolvedTrusteeName;
    const notAlreadyInCandidates = !enrichedCandidates.find(
      (c) => c.trusteeId === verification.resolvedTrusteeId,
    );
    if (isApprovedWithUnresolvedName && notAlreadyInCandidates) {
      try {
        const resolved = await trusteesRepo.read(verification.resolvedTrusteeId);
        resolvedTrusteeName = resolved.name;
      } catch {
        // name unavailable — UI falls back to trustee ID
      }
    }
    return resolvedTrusteeName;
  }

  private resolveCourtName(
    verification: TrusteeMatchVerification,
    courts: CourtDivisionDetails[],
  ): string | undefined {
    // Enrich court name so the UI can display it without needing the USTP courts list.
    // Includes division name (e.g. "Southern District of New York - Manhattan").
    try {
      const { divisionCode } = getCaseIdParts(verification.caseId);
      const court = this.findCourt(courts, divisionCode, verification.courtId);
      if (!court) return undefined;
      return court.courtDivisionName
        ? `${court.courtName} - ${court.courtDivisionName}`
        : court.courtName;
    } catch {
      const court = this.findCourt(courts, undefined, verification.courtId);
      if (!court) return undefined;
      return court.courtDivisionName
        ? `${court.courtName} - ${court.courtDivisionName}`
        : court.courtName;
    }
  }

  private findCourt(
    courts: CourtDivisionDetails[],
    divisionCode?: string,
    courtId?: string,
  ): CourtDivisionDetails | undefined {
    if (divisionCode) {
      const byDivision = courts.find((c) => c.courtDivisionCode === divisionCode);
      if (byDivision) return byDivision;
    }
    return courts.find((c) => c.courtId === courtId);
  }

  private async handlePatch(context: ApplicationContext): Promise<CamsHttpResponseInit<undefined>> {
    if (!context.session.user.roles.includes(CamsRole.DataVerifier)) {
      throw new UnauthorizedError(MODULE_NAME);
    }

    const id = context.request.params['id'];
    if (!id) {
      throw new BadRequestError(MODULE_NAME, { message: 'Missing verification ID.' });
    }

    const body = context.request.body as {
      action?: string;
      resolvedTrusteeId?: string;
      resolvedTrusteeName?: string;
      reason?: string;
    };
    const useCase = new TrusteeMatchVerificationUseCase();

    if (body?.action === 'approve') {
      if (!body.resolvedTrusteeId) {
        throw new BadRequestError(MODULE_NAME, { message: 'Missing resolvedTrusteeId.' });
      }
      await useCase.approveVerification(
        context,
        id,
        body.resolvedTrusteeId,
        body.resolvedTrusteeName,
      );
      return httpSuccess({ statusCode: HttpStatusCodes.NO_CONTENT });
    } else if (body?.action === 'reject') {
      await useCase.rejectVerification(context, id, body.reason);
      return httpSuccess({ statusCode: HttpStatusCodes.NO_CONTENT });
    }

    throw new BadRequestError(MODULE_NAME, { message: 'Missing or invalid action.' });
  }
}
