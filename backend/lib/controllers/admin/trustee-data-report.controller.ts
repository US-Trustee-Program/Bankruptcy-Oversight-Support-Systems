import { ApplicationContext } from '../../adapters/types/basic';
import { CamsController } from '../controller';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { CamsRole } from '@common/cams/roles';
import HttpStatusCodes from '@common/api/http-status-codes';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { BadRequestError } from '../../common-errors/bad-request';
import { getCamsError } from '../../common-errors/error-utilities';
import { startTrusteeDataReport } from '../../use-cases/trustee-data-report/start-trustee-data-report';
import { getLatestTrusteeDataReport } from '../../use-cases/trustee-data-report/get-latest-trustee-data-report';

const MODULE_NAME = 'TRUSTEE-DATA-REPORT-CONTROLLER';
const UNSUPPORTED_HTTP_METHOD = 'Unsupported HTTP Method';

export class TrusteeDataReportController implements CamsController {
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<object | undefined>> {
    try {
      if (!context.session.user.roles.includes(CamsRole.SuperUser)) {
        throw new ForbiddenError(MODULE_NAME);
      }

      switch (context.request.method) {
        case 'POST': {
          const data = await startTrusteeDataReport(context);
          return httpSuccess({ statusCode: HttpStatusCodes.CREATED, body: { data } });
        }
        case 'GET': {
          const data = await getLatestTrusteeDataReport(context);
          return httpSuccess({ statusCode: HttpStatusCodes.OK, body: { data } });
        }
        default:
          throw new BadRequestError(MODULE_NAME, { message: UNSUPPORTED_HTTP_METHOD });
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
