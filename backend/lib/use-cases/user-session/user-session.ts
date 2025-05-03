import { CamsSession } from '../../../../common/src/cams/session';
import { ApplicationContext } from '../../adapters/types/basic';
import { isCamsError } from '../../common-errors/cams-error';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { getAuthorizationGateway, getUserSessionCacheRepository } from '../../factory';
import UsersHelpers from '../users/users.helpers';

const MODULE_NAME = 'USER-SESSION-GATEWAY';

export class UserSessionUseCase {
  async lookup(context: ApplicationContext, token: string, provider: string): Promise<CamsSession> {
    const sessionCacheRepository = getUserSessionCacheRepository(context);

    try {
      const session = await sessionCacheRepository.read(token);
      context.logger.debug(MODULE_NAME, 'Found session in cache.');
      return session;
    } catch (originalError) {
      if (isNotFoundError(originalError)) {
        // This is a cache miss. Continue.
        context.logger.debug(MODULE_NAME, 'Did not find session in cache.');
      } else {
        throw originalError;
      }
    }

    try {
      const authGateway = getAuthorizationGateway(context);
      if (!authGateway) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Unsupported authentication provider.',
        });
      }

      context.logger.debug(MODULE_NAME, 'Getting user info from Okta.');
      const { jwt, user: camsUserReference } = await authGateway.getUser(token);
      const user = await UsersHelpers.getPrivilegedIdentityUser(context, camsUserReference.id);

      const session: CamsSession = {
        accessToken: token,
        expires: jwt.claims.exp,
        issuer: jwt.claims.iss,
        provider: provider,
        user,
      };

      context.logger.debug(MODULE_NAME, 'Putting session in cache.');
      await sessionCacheRepository.upsert(session);
      return session;
    } catch (error) {
      throw isCamsError(error)
        ? error
        : new UnauthorizedError(MODULE_NAME, {
            message: error.message,
            originalError: error,
          });
    }
  }
}
