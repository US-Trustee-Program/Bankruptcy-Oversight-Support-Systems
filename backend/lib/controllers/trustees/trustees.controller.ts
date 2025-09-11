import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesUseCase } from '../../use-cases/trustees/trustees';
import { Trustee, TrusteeInput } from '../../../../common/src/cams/trustees';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { CamsRole } from '../../../../common/src/cams/roles';

const MODULE_NAME = 'TRUSTEES-CONTROLLER';

export class TrusteesController implements CamsController {
  private readonly useCase: TrusteesUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new TrusteesUseCase(context);
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<Trustee | Trustee[]>> {
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
          message: 'User does not have permission to manage trustees',
        }),
        MODULE_NAME,
      );
    }

    const { method } = context.request;

    if (!['POST', 'GET'].includes(method)) {
      throw getCamsError(
        new BadRequestError(MODULE_NAME, {
          message: `HTTP method ${method} is not supported`,
        }),
        MODULE_NAME,
      );
    }

    try {
      switch (method) {
        case 'POST':
          return await this.createTrustee(context);
        case 'GET':
          return await this.handleGetRequest(context);
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  private async createTrustee(context: ApplicationContext): Promise<CamsHttpResponseInit<Trustee>> {
    const { body } = context.request;

    if (!body) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Request body is required for trustee creation',
      });
    }

    const trusteeData = body as TrusteeInput;
    const createdTrustee = await this.useCase.createTrustee(context, trusteeData);

    return httpSuccess({
      statusCode: 201,
      body: {
        meta: {
          self: `${context.request.url}/${createdTrustee.id}`,
        },
        data: createdTrustee,
      },
    });
  }

  private async handleGetRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<Trustee | Trustee[]>> {
    const trusteeId = context.request.params['id'];

    if (trusteeId) {
      return await this.getTrustee(context, trusteeId);
    } else {
      return await this.listTrustees(context);
    }
  }

  private async getTrustee(
    context: ApplicationContext,
    id: string,
  ): Promise<CamsHttpResponseInit<Trustee>> {
    const trustee = await this.useCase.getTrustee(context, id);

    return httpSuccess({
      statusCode: 200,
      body: {
        meta: {
          self: context.request.url,
        },
        data: trustee,
      },
    });
  }

  private async listTrustees(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<Trustee[]>> {
    const trustees = await this.useCase.listTrustees(context);

    return httpSuccess({
      statusCode: 200,
      body: {
        meta: {
          self: context.request.url,
        },
        data: trustees,
      },
    });
  }

  private hasRequiredRole(context: ApplicationContext): boolean {
    const user = context.session?.user;
    if (!user?.roles) {
      return false;
    }

    // Check if user has trustee-admin role
    return user.roles.includes(CamsRole.TrusteeAdmin);
  }
}
