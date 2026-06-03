import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { TrusteeMatchVerificationUseCase } from '../../use-cases/trustee-match-verification/trustee-match-verification.use-case';
import HttpStatusCodes from '@common/api/http-status-codes';
import { CamsRole } from '@common/cams/roles';

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
    const useCase = new TrusteeMatchVerificationUseCase();
    const data = await useCase.getVerifications(context, {
      statusParam: context.request.query.status as string | undefined,
    });

    return httpSuccess({
      body: {
        meta: { self: context.request.url },
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
