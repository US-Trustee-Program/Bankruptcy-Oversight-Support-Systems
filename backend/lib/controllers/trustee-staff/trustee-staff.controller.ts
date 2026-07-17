import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeStaffUseCase } from '../../use-cases/trustee-staff/trustee-staff';
import { TrusteeStaff, TrusteeStaffInput } from '@common/cams/trustee-staff';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { CamsRole } from '@common/cams/roles';

const MODULE_NAME = 'TRUSTEE-STAFF-CONTROLLER';

export class TrusteeStaffController implements CamsController {
  private readonly useCase: TrusteeStaffUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new TrusteeStaffUseCase(context);
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeStaff[] | TrusteeStaff | undefined>> {
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
          message: 'User does not have permission to access trustee staff',
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
        case 'PUT':
          return await this.handlePutRequest(context);
        case 'DELETE':
          return await this.handleDeleteRequest(context);
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
  ): Promise<CamsHttpResponseInit<TrusteeStaff[] | TrusteeStaff>> {
    const trusteeId = context.request.params['trusteeId'];
    const staffId = context.request.params['staffId'];

    if (!trusteeId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required',
      });
    }

    // If staffId is provided, get single staff member
    if (staffId) {
      const staffMember = await this.useCase.getStaffMember(context, trusteeId, staffId);

      return httpSuccess({
        statusCode: 200,
        body: {
          meta: {
            self: context.request.url,
          },
          data: staffMember,
        },
      });
    }

    // Otherwise, get all staff for trustee
    const staff = await this.useCase.getTrusteeStaff(context, trusteeId);

    return httpSuccess({
      statusCode: 200,
      body: {
        meta: {
          self: context.request.url,
        },
        data: staff,
      },
    });
  }

  private async handlePostRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeStaff>> {
    const trusteeId = context.request.params['trusteeId'];

    if (!trusteeId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required',
      });
    }

    const input = context.request.body as TrusteeStaffInput;

    if (!input) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Request body is required',
      });
    }

    const staffMember = await this.useCase.createStaffMember(context, trusteeId, input);

    return httpSuccess({
      statusCode: 201,
      body: {
        meta: {
          self: `${context.request.url}/${staffMember.id}`,
        },
        data: staffMember,
      },
    });
  }

  private async handlePutRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeStaff>> {
    const trusteeId = context.request.params['trusteeId'];
    const staffId = context.request.params['staffId'];

    if (!trusteeId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required',
      });
    }

    if (!staffId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Staff ID is required',
      });
    }

    const input = context.request.body as TrusteeStaffInput;

    if (!input) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Request body is required',
      });
    }

    const updatedStaffMember = await this.useCase.updateStaffMember(
      context,
      trusteeId,
      staffId,
      input,
    );

    return httpSuccess({
      statusCode: 200,
      body: {
        meta: {
          self: context.request.url,
        },
        data: updatedStaffMember,
      },
    });
  }

  private async handleDeleteRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<undefined>> {
    const trusteeId = context.request.params['trusteeId'];
    const staffId = context.request.params['staffId'];

    if (!trusteeId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required',
      });
    }

    if (!staffId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Staff ID is required',
      });
    }

    await this.useCase.deleteStaffMember(context, trusteeId, staffId);

    return { statusCode: 204 };
  }

  private hasRequiredRole(context: ApplicationContext): boolean {
    const user = context.session?.user;
    if (!user?.roles) {
      return false;
    }

    return user.roles.includes(CamsRole.TrusteeAdmin);
  }
}
