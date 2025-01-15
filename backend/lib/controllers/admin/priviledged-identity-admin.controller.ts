import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { CamsController } from '../controller';
import { AdminUseCase } from '../../use-cases/admin/admin';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsRole } from '../../../../common/src/cams/roles';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { getFeatureFlags } from '../../adapters/utils/feature-flag';

const MODULE_NAME = 'PRIVILEDGED-IDENTITY-ADMIN-CONTROLLER';

const UNSUPPORTED_HTTP_METHOD = 'Unsupported HTTP Method';
const NOT_ENABLED = 'Priviledged identity management feature is not enabled.';

export class PriviledgedIdentityAdminController implements CamsController {
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<object | undefined>> {
    try {
      const featureFlags = await getFeatureFlags(context.config);
      if (!featureFlags['privileged-identity-management']) {
        throw new UnauthorizedError(MODULE_NAME, { message: NOT_ENABLED });
      }

      if (!context.session.user.roles.includes(CamsRole.SuperUser)) {
        throw new UnauthorizedError(MODULE_NAME);
      }

      const useCase = new AdminUseCase();

      const method = context.request.method;
      const resourceId = context.request.params.resourceId;

      const doGetGroups = resourceId === 'groups' && method === 'GET';
      const userId = resourceId && resourceId !== 'groups' ? resourceId : undefined;
      const doGetUsers = !userId && method === 'GET';
      const doGetUser = userId && method === 'GET';
      const doDeleteUser = userId && method === 'DELETE';
      const doUpsertUser = userId && method === 'PUT';

      if (doGetGroups) {
        const data = await useCase.getRoleAndOfficeGroupNames(context);
        return httpSuccess({ body: { data }, statusCode: 200 });
      } else if (doGetUsers) {
        const data = await useCase.getPrivilegedIdentityUsers(context);
        return httpSuccess({ body: { data }, statusCode: 200 });
      } else if (doGetUser) {
        const data = await useCase.getPrivilegedIdentityUser(context, userId);
        return httpSuccess({ body: { data }, statusCode: 200 });
      } else if (doDeleteUser) {
        await useCase.deletePrivilegedIdentityUser(context, userId);
        return httpSuccess({ statusCode: 204 });
      } else if (doUpsertUser) {
        const groups = context.request.body['groups'];
        const expires = context.request.body['expires'];
        await useCase.upsertPrivilegedIdentityUser(context, userId, { groups, expires });
        return httpSuccess({ statusCode: 201 });
      } else {
        throw new BadRequestError(MODULE_NAME, { message: UNSUPPORTED_HTTP_METHOD });
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
