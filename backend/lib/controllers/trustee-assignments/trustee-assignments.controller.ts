import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAssignmentsUseCase } from '../../use-cases/trustee-assignments/trustee-assignments';
import { TrusteeOversightAssignment } from '../../../../common/src/cams/trustees';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { NotFoundError } from '../../common-errors/not-found-error';
import { OversightRole } from '../../../../common/src/cams/roles';

const MODULE_NAME = 'TRUSTEE-ASSIGNMENTS-CONTROLLER';

interface CreateAssignmentRequest {
  userId: string;
  role: OversightRole;
}

export class TrusteeAssignmentsController implements CamsController {
  private readonly useCase: TrusteeAssignmentsUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new TrusteeAssignmentsUseCase(context);
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeOversightAssignment[] | undefined>> {
    if (!context.featureFlags['trustee-management']) {
      throw new NotFoundError(MODULE_NAME);
    }

    if (!context.session) {
      throw new UnauthorizedError(MODULE_NAME);
    }

    const { method, url } = context.request;

    if (!['POST', 'GET'].includes(method)) {
      throw new BadRequestError(MODULE_NAME, {
        message: `HTTP method ${method} is not supported`,
      });
    }

    try {
      // Handle GET /api/v1/trustee-assignments/oversight-staff endpoint
      if (method === 'GET' && url.includes('/trustee-assignments/oversight-staff')) {
        return await this.getOversightStaff(context);
      }

      switch (method) {
        case 'GET':
          return await this.getTrusteeOversightAssignments(context);
        case 'POST':
          return await this.createOversightAssignment(context);
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  private async getOversightStaff(context: ApplicationContext): Promise<CamsHttpResponseInit> {
    const staff = await this.useCase.getOversightStaff(context);

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

  private async getTrusteeOversightAssignments(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeOversightAssignment[]>> {
    const trusteeId = context.request.params['trusteeId'];

    if (!trusteeId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required',
      });
    }

    const assignments = await this.useCase.getTrusteeOversightAssignments(context, trusteeId);

    return httpSuccess({
      statusCode: 200,
      body: {
        meta: {
          self: context.request.url,
        },
        data: assignments,
      },
    });
  }

  private async createOversightAssignment(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<undefined>> {
    const trusteeId = context.request.params['trusteeId'];
    const { body } = context.request;

    if (!trusteeId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required',
      });
    }

    if (!body) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Request body is required for assignment creation',
      });
    }

    const requestData = body as CreateAssignmentRequest;

    if (!requestData.userId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'User ID is required in request body',
      });
    }

    if (!requestData.role) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Role is required in request body',
      });
    }

    const validOversightRoles = Object.values(OversightRole);
    if (!validOversightRoles.includes(requestData.role)) {
      throw new BadRequestError(MODULE_NAME, {
        message: `Role must be a valid OversightRole. Received: ${requestData.role}`,
      });
    }

    const wasCreated = await this.useCase.assignOversightStaffToTrustee(
      context,
      trusteeId,
      requestData.userId,
      requestData.role,
    );

    return httpSuccess({
      statusCode: wasCreated ? 201 : 204,
      body: undefined,
    });
  }
}
