import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { TrusteeAppointmentVerificationListItem } from '@common/cams/trustee-appointment-verification';
import { listAppointmentTasks } from '../../use-cases/trustee-appointment-verification/trustee-appointment-verification.use-case';
import { CamsRole } from '@common/cams/roles';

const MODULE_NAME = 'TRUSTEE-APPOINTMENT-VERIFICATION-CONTROLLER';

/**
 * Lists open trustee appointment tasks (CAMS-956) for the Data Verification queue. Behind the
 * same feature flag and DataVerifier role as trustee identity tasks.
 */
export class TrusteeAppointmentVerificationController {
  async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeAppointmentVerificationListItem[]>> {
    if (!context.featureFlags['trustee-verification-enabled']) {
      return { statusCode: 404 };
    }

    try {
      if (!context.session.user.roles.includes(CamsRole.DataVerifier)) {
        throw new UnauthorizedError(MODULE_NAME);
      }
      if (context.request.method !== 'GET') {
        throw new BadRequestError(MODULE_NAME, { message: 'Unsupported method.' });
      }

      const data = await listAppointmentTasks(context);
      return httpSuccess({
        body: {
          meta: { self: context.request.url },
          data,
        },
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
