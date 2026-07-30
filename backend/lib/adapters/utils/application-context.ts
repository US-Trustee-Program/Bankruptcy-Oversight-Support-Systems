import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../types/basic';
import { getFeatureFlags } from './feature-flag';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import factory from '../../factory';
import { sanitizeDeep } from '../../use-cases/validations';

/**
 * Extracts and verifies the bearer token from the request and resolves the CAMS
 * session. Shared by the Express and Azure context creators; `moduleName`
 * identifies the calling host in any thrown UnauthorizedError.
 */
export async function getApplicationContextSession(
  context: ApplicationContext,
  moduleName: string,
) {
  const authorizationHeader = context.request?.headers['authorization'];

  if (!authorizationHeader) {
    throw new UnauthorizedError(moduleName, {
      message: 'Authorization header missing.',
    });
  }

  const match = authorizationHeader.match(/Bearer (.+)/);

  if (!match || match.length !== 2) {
    throw new UnauthorizedError(moduleName, {
      message: 'Bearer token not found in authorization header',
    });
  }

  let accessToken = '';
  const jwtToken = jwt.decode(match[1]);
  if (jwtToken) {
    accessToken = match[1];
  } else {
    throw new UnauthorizedError(moduleName, {
      message: 'Malformed Bearer token in authorization header',
    });
  }

  const sessionUseCase = factory.getUserSessionUseCase(context);
  return sessionUseCase.lookup(context, accessToken);
}

/**
 * Completes a freshly-built application context: sanitizes the request, resolves
 * the session, then reconciles feature flags to the authenticated user.
 *
 * The context passed in MUST already carry the anonymous feature-flag evaluation.
 * Session resolution reads feature flags — PIM role elevation is gated on the
 * 'privileged-identity-management' flag — so an empty flag set at this point
 * silently drops a user's elevated roles. Feature flags are re-evaluated against
 * the resolved user afterward so request handlers see user-targeted values.
 */
export async function finalizeApplicationContext<B = unknown>(
  context: ApplicationContext<B>,
  moduleName: string,
): Promise<ApplicationContext<B>> {
  context.request = sanitizeDeep(context.request, moduleName, context.logger);
  context.session = await getApplicationContextSession(context, moduleName);
  context.featureFlags = await getFeatureFlags(context.config, context.session.user);
  return context;
}
