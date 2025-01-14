import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit } from '../../adapters/utils/http-response';
import { CamsController } from '../controller';
import { AdminUseCase, CreateStaffRequestBody } from '../../use-cases/admin/admin';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';

const MODULE_NAME = 'ADMIN-CONTROLLER';
const deleteStaff = 'deleteStaff';
const createStaff = 'createStaff';
const SUPPORTED_PROCEDURES = [createStaff, deleteStaff];

export class StaffAdminController implements CamsController {
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<object | undefined>> {
    const procedure = context.request.params.procedure;
    const useCase = new AdminUseCase();
    if (!SUPPORTED_PROCEDURES.includes(procedure)) {
      throw new BadRequestError(MODULE_NAME, { message: 'Procedure not found' });
    }

    try {
      // TODO: we should probably now treat this more RESTfully and not use procedure
      if (procedure === createStaff && context.request.method === 'POST') {
        const requestBody: CreateStaffRequestBody = context.request.body as CreateStaffRequestBody;
        const result = await useCase.addOfficeStaff(context, requestBody);
        return { statusCode: result.upsertedCount === 1 ? 201 : 204 };
      } else if (procedure === deleteStaff && context.request.method === 'DELETE') {
        await useCase.deleteStaff(
          context,
          context.request.body['officeCode'],
          context.request.body['id'],
        );
        return { statusCode: 204 };
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
