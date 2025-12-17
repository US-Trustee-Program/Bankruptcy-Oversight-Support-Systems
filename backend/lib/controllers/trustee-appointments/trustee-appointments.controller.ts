import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAppointmentsUseCase } from '../../use-cases/trustee-appointments/trustee-appointments';
import {
  TrusteeAppointment,
  TrusteeAppointmentInput,
} from '../../../../common/src/cams/trustee-appointments';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { CamsRole } from '../../../../common/src/cams/roles';

const MODULE_NAME = 'TRUSTEE-APPOINTMENTS-CONTROLLER';

export class TrusteeAppointmentsController implements CamsController {
  private readonly useCase: TrusteeAppointmentsUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new TrusteeAppointmentsUseCase(context);
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeAppointment[]>> {
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
          message: 'User does not have permission to access trustee appointments',
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
  ): Promise<CamsHttpResponseInit<TrusteeAppointment[]>> {
    const trusteeId = context.request.params['trusteeId'];

    if (!trusteeId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required',
      });
    }

    const appointments = await this.useCase.getTrusteeAppointments(context, trusteeId);

    return httpSuccess({
      statusCode: 200,
      body: {
        meta: {
          self: context.request.url,
        },
        data: appointments,
      },
    });
  }

  private async handlePostRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeAppointment[]>> {
    const trusteeId = context.request.params['trusteeId'];
    const { body } = context.request;

    if (!trusteeId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required',
      });
    }

    if (!body) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Request body is required for appointment creation',
      });
    }

    const appointmentData = body as TrusteeAppointmentInput;
    const createdAppointment = await this.useCase.createAppointment(
      context,
      trusteeId,
      appointmentData,
    );

    return httpSuccess({
      statusCode: 201,
      body: {
        meta: {
          self: `${context.request.url}/${createdAppointment.id}`,
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

    // Check if user has trustee-admin role
    return user.roles.includes(CamsRole.TrusteeAdmin);
  }
}
