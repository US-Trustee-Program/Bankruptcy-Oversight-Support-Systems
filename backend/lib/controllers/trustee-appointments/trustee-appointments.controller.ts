import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAppointmentsUseCase } from '../../use-cases/trustee-appointments/trustee-appointments';
import { TrusteeAppointment } from '../../../../common/src/cams/trustee-appointments';
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
  ): Promise<CamsHttpResponseInit<TrusteeAppointment | TrusteeAppointment[]>> {
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
          message: 'User does not have permission to view trustee appointments',
        }),
        MODULE_NAME,
      );
    }

    const { method } = context.request;

    if (method !== 'GET') {
      throw getCamsError(
        new BadRequestError(MODULE_NAME, {
          message: `HTTP method ${method} is not supported`,
        }),
        MODULE_NAME,
      );
    }

    try {
      return await this.handleGetRequest(context);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  private async handleGetRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeAppointment | TrusteeAppointment[]>> {
    const appointmentId = context.request.params['id'];
    const trusteeId = context.request.query?.trusteeId;

    if (appointmentId) {
      return await this.getTrusteeAppointment(context, appointmentId);
    } else if (trusteeId) {
      return await this.getTrusteeAppointments(context, trusteeId);
    } else {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Either appointment ID or trusteeId query parameter is required',
      });
    }
  }

  private async getTrusteeAppointment(
    context: ApplicationContext,
    id: string,
  ): Promise<CamsHttpResponseInit<TrusteeAppointment>> {
    const appointment = await this.useCase.getTrusteeAppointment(context, id);

    return httpSuccess({
      statusCode: 200,
      body: {
        meta: {
          self: context.request.url,
        },
        data: appointment,
      },
    });
  }

  private async getTrusteeAppointments(
    context: ApplicationContext,
    trusteeId: string,
  ): Promise<CamsHttpResponseInit<TrusteeAppointment[]>> {
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

  private hasRequiredRole(context: ApplicationContext): boolean {
    const user = context.session?.user;
    if (!user?.roles) {
      return false;
    }

    // Check if user has trustee-admin role
    return user.roles.includes(CamsRole.TrusteeAdmin);
  }
}
