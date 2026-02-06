import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAssistantsUseCase } from '../../use-cases/trustee-assistants/trustee-assistants';
import { TrusteeAssistant, TrusteeAssistantInput } from '@common/cams/trustee-assistants';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { CamsRole } from '@common/cams/roles';

const MODULE_NAME = 'TRUSTEE-ASSISTANTS-CONTROLLER';

export class TrusteeAssistantsController implements CamsController {
  private readonly useCase: TrusteeAssistantsUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new TrusteeAssistantsUseCase(context);
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeAssistant[] | undefined>> {
    // Check feature flag
    if (!context.featureFlags['trustee-management']) {
      return {
        statusCode: 404,
      };
    }

    // Check user authorization for trustee admin role
    if (!this.hasRequiredRole(context)) {
      throw getCamsError(
        new UnauthorizedError(MODULE_NAME, {
          message: 'User does not have permission to access trustee assistants',
        }),
        MODULE_NAME,
      );
    }

    const { method } = context.request;

    try {
      switch (method) {
        case 'GET':
          return await this.handleGetRequest(context);
        case 'POST':
          return await this.handlePostRequest(context);
        // TODO: Add PUT, DELETE in future slices
        default:
          throw new BadRequestError(MODULE_NAME, {
            message: `HTTP method ${method} is not supported`,
          });
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  private async handleGetRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeAssistant[]>> {
    const trusteeId = context.request.params['trusteeId'];

    if (!trusteeId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required',
      });
    }

    const assistants = await this.useCase.getTrusteeAssistants(context, trusteeId);

    return httpSuccess({
      statusCode: 200,
      body: {
        meta: {
          self: context.request.url,
        },
        data: assistants,
      },
    });
  }

  private async handlePostRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<undefined>> {
    const trusteeId = context.request.params['trusteeId'];

    if (!trusteeId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required',
      });
    }

    const input = context.request.body as TrusteeAssistantInput;

    if (!input) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Request body is required',
      });
    }

    const assistant = await this.useCase.createAssistant(context, trusteeId, input);

    return httpSuccess({
      statusCode: 201,
      body: {
        meta: {
          self: `${context.request.url}/${assistant.id}`,
        },
        data: undefined,
      },
    });
  }

  private hasRequiredRole(context: ApplicationContext): boolean {
    const user = context.session?.user;
    if (!user?.roles) {
      return false;
    }

    return user.roles.includes(CamsRole.TrusteeAdmin);
  }
}
