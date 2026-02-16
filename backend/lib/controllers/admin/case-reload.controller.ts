import { ApplicationContext } from '../../adapters/types/basic';
import { CamsController } from '../controller';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { CamsRole } from '@common/cams/roles';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { BadRequestError } from '../../common-errors/bad-request';
import { getCamsError } from '../../common-errors/error-utilities';
import CaseReloadUseCase from '../../use-cases/admin/case-reload';
import { CASE_ID_REGEX } from '@common/cams/regex';

const MODULE_NAME = 'CASE-RELOAD-CONTROLLER';
const UNSUPPORTED_HTTP_METHOD = 'Unsupported HTTP Method';
const INVALID_REQUEST = 'caseId is required';

export class CaseReloadController implements CamsController {
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<object | undefined>> {
    try {
      if (!context.session.user.roles.includes(CamsRole.SuperUser)) {
        throw new ForbiddenError(MODULE_NAME);
      }

      if (context.request.method !== 'POST') {
        throw new BadRequestError(MODULE_NAME, { message: UNSUPPORTED_HTTP_METHOD });
      }

      const { caseId } = context.request.body as { caseId?: string };
      if (!caseId || typeof caseId !== 'string' || caseId.trim() === '') {
        throw new BadRequestError(MODULE_NAME, { message: INVALID_REQUEST });
      }

      if (!CASE_ID_REGEX.test(caseId)) {
        throw new BadRequestError(MODULE_NAME, {
          message: 'Invalid case ID format. Expected format: XXX-XX-XXXXX',
        });
      }

      await CaseReloadUseCase.queueCaseReload(context, caseId);

      return httpSuccess({ statusCode: 201 });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
