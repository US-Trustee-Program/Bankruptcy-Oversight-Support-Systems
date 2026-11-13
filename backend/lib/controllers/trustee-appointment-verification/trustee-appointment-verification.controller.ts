import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import {
  TrusteeAppointmentRefreshResult,
  TrusteeAppointmentVerificationDetail,
  TrusteeAppointmentVerificationListItem,
} from '@common/cams/trustee-appointment-verification';
import {
  getAppointmentTaskDetail,
  listAppointmentTasks,
  refreshAppointmentTask,
} from '../../use-cases/trustee-appointment-verification/trustee-appointment-verification.use-case';
import { CamsRole } from '@common/cams/roles';

const MODULE_NAME = 'TRUSTEE-APPOINTMENT-VERIFICATION-CONTROLLER';

type ResponseData =
  | TrusteeAppointmentVerificationListItem[]
  | TrusteeAppointmentVerificationDetail
  | TrusteeAppointmentRefreshResult;

/**
 * Trustee appointment tasks (CAMS-956) for the Data Verification queue. GET lists the open tasks,
 * or returns one task's detail by id. PATCH { action: 'refresh' } on a task re-checks the
 * trustee's appointments and resolves the task if one now covers it. Requests for one task carry
 * its trusteeId (the shard key) as a query parameter. Behind the same feature flag and
 * DataVerifier role as trustee identity tasks.
 */
export class TrusteeAppointmentVerificationController {
  async handleRequest(context: ApplicationContext): Promise<CamsHttpResponseInit<ResponseData>> {
    if (!context.featureFlags['trustee-verification-enabled']) {
      return { statusCode: 404 };
    }

    try {
      if (!context.session.user.roles.includes(CamsRole.DataVerifier)) {
        throw new UnauthorizedError(MODULE_NAME);
      }

      let data: ResponseData;
      if (context.request.method === 'GET') {
        const id = context.request.params['id'];
        data = id
          ? await getAppointmentTaskDetail(context, id, requireTrusteeId(context))
          : await listAppointmentTasks(context);
      } else if (context.request.method === 'PATCH') {
        data = await handlePatch(context);
      } else {
        throw new BadRequestError(MODULE_NAME, { message: 'Unsupported method.' });
      }
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

function requireTrusteeId(context: ApplicationContext): string {
  const trusteeId = context.request.query['trusteeId'];
  if (!trusteeId) {
    throw new BadRequestError(MODULE_NAME, { message: 'Missing trusteeId.' });
  }
  return trusteeId;
}

async function handlePatch(context: ApplicationContext): Promise<TrusteeAppointmentRefreshResult> {
  const id = context.request.params['id'];
  if (!id) {
    throw new BadRequestError(MODULE_NAME, { message: 'Missing task ID.' });
  }
  const trusteeId = requireTrusteeId(context);
  const body = context.request.body as { action?: string } | undefined;
  if (body?.action !== 'refresh') {
    throw new BadRequestError(MODULE_NAME, { message: 'Missing or invalid action.' });
  }
  return refreshAppointmentTask(context, id, trusteeId);
}
