import { ApplicationContext } from '../../adapters/types/basic';
import StaffUseCase from '../../use-cases/staff/staff';
import { Staff } from '../../../../common/src/cams/users';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';

const MODULE_NAME = 'STAFF-CONTROLLER';

export class StaffController implements CamsController {
  private readonly useCase: StaffUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new StaffUseCase(context);
  }

  public async handleRequest(context: ApplicationContext): Promise<CamsHttpResponseInit<Staff[]>> {
    try {
      const staffType = context.request?.params?.staffType || '';
      let data: Staff[];

      if (staffType === 'auditors') {
        data = await this.useCase.getAuditorList(context);
      } else {
        // Default to attorneys for backward compatibility
        data = await this.useCase.getAttorneyList(context);
      }

      return httpSuccess({ body: { data } });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
