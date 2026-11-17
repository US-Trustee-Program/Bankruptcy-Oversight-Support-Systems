import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { CamsController } from '../controller';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsRole } from '@common/cams/roles';
import HttpStatusCodes from '@common/api/http-status-codes';
import { getCaseAppointmentSources } from '../../use-cases/admin/case-appointment-source';
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

  private requireSuperUser(context: ApplicationContext): void {
    if (!context.session.user.roles?.includes(CamsRole.SuperUser)) {
      throw new ForbiddenError(MODULE_NAME);
    }
  }
}
