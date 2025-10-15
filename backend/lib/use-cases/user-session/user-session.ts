import { getAuthorizationGateway, getUserSessionCacheRepository } from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { isCamsError } from '../../common-errors/cams-error';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CamsSession } from '../../../../common/src/cams/session';
import { isNotFoundError } from '../../common-errors/not-found-error';
import UsersHelpers from '../users/users.helpers';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { CamsJwt } from '../../../../common/src/cams/jwt';
import { delay } from '../../../../common/src/delay';

const MODULE_NAME = 'USER-SESSION-GATEWAY';

type GetUserResponse = { user: CamsUserReference; jwt: CamsJwt };

export class UserSessionUseCase {
  private async lookupSession(context: ApplicationContext, token: string) {
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
  }

  private async getUserFromIdentityProvider(
    context: ApplicationContext,
    token: string,
  ): Promise<GetUserResponse> {
    const authGateway = getAuthorizationGateway(context);
    if (!authGateway) {
      throw new ServerConfigError(MODULE_NAME, {
        message: 'Unsupported authentication provider.',
      });
    }

    let response: GetUserResponse;
    let callCount = 0;
    const MAX_CALL_COUNT = 3;

    context.logger.debug(MODULE_NAME, 'Getting user info from identity provider.');
    while (!response && callCount <= MAX_CALL_COUNT) {
      try {
        return await authGateway.getUser(token);
      } catch (error) {
        callCount++;
        context.logger.error(
          `Call to identity provider to get user failed.`,
          `Call count=${callCount}.`,
          error.message,
        );
        if (callCount === MAX_CALL_COUNT) {
          throw error;
        } else {
          await delay(Math.pow(2, callCount) * 1000);
        }
      }
    }
  }

  private async writeSession(context: ApplicationContext, session: CamsSession) {
    const sessionCacheRepository = getUserSessionCacheRepository(context);
    context.logger.debug(MODULE_NAME, 'Putting session in cache.');
    await sessionCacheRepository.upsert(session);
  }

  async lookup(context: ApplicationContext, token: string, provider: string): Promise<CamsSession> {
    try {
      // Check for a cached session to return.
      const storedSession = await this.lookupSession(context, token);
      if (storedSession) {
        return storedSession;
      }

      // Otherwise get the user information from the identity provider.
      const { user: camsUserReference, jwt } = await this.getUserFromIdentityProvider(
        context,
        token,
      );

      // Augment the user session with additional roles if applicable.
      const user = await UsersHelpers.getPrivilegedIdentityUser(context, camsUserReference.id);

      // Cache and return a new session.
      const newSession = {
        user,
        accessToken: token,
        provider: provider,
        expires: jwt.claims.exp,
        issuer: jwt.claims.iss,
      };
      await this.writeSession(context, newSession);
      return newSession;
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnauthorizedError(MODULE_NAME, {
            message: originalError.message,
            originalError,
          });
    }
  }
}
