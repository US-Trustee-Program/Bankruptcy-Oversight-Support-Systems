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
import { OrderStatus } from '@common/cams/orders';
import { DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET } from '@common/api/search';
import { calculatePagination } from '../pagination';

const MODULE_NAME = 'TRUSTEE-MATCH-VERIFICATION-CONTROLLER';

export class TrusteeMatchVerificationController {
  async handleRequest(
    context: ApplicationContext,
  ): Promise<
    CamsHttpResponseInit<TrusteeMatchVerification | TrusteeMatchVerification[] | undefined>
  > {
    if (!context.featureFlags['trustee-verification-enabled']) {
      return { statusCode: 404 };
    }

    try {
      if (context.request.method === 'GET') {
        const id = context.request.params['id'];
        if (id) {
          return await this.getVerificationById(context, id);
        }
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
    const statusParam = context.request.query.status as string | undefined;
    const status: OrderStatus[] = statusParam
      ? (statusParam.split(',') as OrderStatus[])
      : ['pending'];

    const parsedLimit = parseInt(context.request.query.limit as string);
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_SEARCH_LIMIT;

    const parsedOffset = parseInt(context.request.query.offset as string);
    const offset =
      Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : DEFAULT_SEARCH_OFFSET;

    const repo = factory.getTrusteeMatchVerificationRepository(context);
    const result = await repo.searchPaginated({ status }, limit, offset);
    const totalCount = result.metadata?.total ?? 0;

    const courts = await new CourtsUseCase().getCourts(context);
    const data = result.data.map((verification) => {
      const courtName = this.resolveCourtName(verification, courts) ?? verification.courtName;
      return { ...verification, courtName };
    });

    return httpSuccess({
      body: {
        meta: { self: context.request.url },
        pagination: calculatePagination(data.length, totalCount, limit, offset),
        data,
      },
    });
  }

  private async getVerificationById(
    context: ApplicationContext,
    id: string,
  ): Promise<CamsHttpResponseInit<TrusteeMatchVerification>> {
    const useCase = new TrusteeMatchVerificationUseCase();
    const enriched = await useCase.getEnrichedVerification(context, id);

    return httpSuccess({
      body: {
        meta: { self: context.request.url },
        data: enriched,
      },
    });
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
