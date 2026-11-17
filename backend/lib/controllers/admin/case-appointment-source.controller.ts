import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { CamsController } from '../controller';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsRole } from '@common/cams/roles';
import HttpStatusCodes from '@common/api/http-status-codes';
import {
  getCaseAppointmentSources,
  switchCaseAppointmentSourceToDxtr,
} from '../../use-cases/admin/case-appointment-source';
import { RegionCaseAppointmentSource } from '@common/cams/trustee-appointments';

const MODULE_NAME = 'CASE-APPOINTMENT-SOURCE-CONTROLLER';

export class CaseAppointmentSourceController implements CamsController {
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<object | undefined>> {
    this.requireSuperUser(context);

    if (context.request.method === 'GET') {
      return this.handleGet(context);
    }

    if (context.request.method === 'PATCH') {
      return this.handlePatch(context);
    }

    return httpSuccess({ statusCode: HttpStatusCodes.METHOD_NOT_ALLOWED }) as CamsHttpResponseInit;
  }

  private async handleGet(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<RegionCaseAppointmentSource[]>> {
    const data = await getCaseAppointmentSources(context);
    return httpSuccess({
      statusCode: HttpStatusCodes.OK,
      body: { meta: { self: context.request.url }, data },
    });
  }

  private async handlePatch(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<RegionCaseAppointmentSource>> {
    const regionId = context.request.params.regionId;
    const body = context.request.body as { source?: unknown } | null | undefined;
    const requestsDxtr =
      !!body &&
      typeof body === 'object' &&
      Object.keys(body).length === 1 &&
      body.source === 'DXTR';

    if (!regionId || !requestsDxtr) {
      throw new BadRequestError(MODULE_NAME, {
        message: "PATCH requires a regionId and a body of exactly { source: 'DXTR' }.",
      });
    }

    const data = await switchCaseAppointmentSourceToDxtr(context, regionId);
    return httpSuccess({
      statusCode: HttpStatusCodes.OK,
      body: { meta: { self: context.request.url }, data },
    });
  }

  private requireSuperUser(context: ApplicationContext): void {
    if (!context.session.user.roles?.includes(CamsRole.SuperUser)) {
      throw new ForbiddenError(MODULE_NAME);
    }
  }
}
