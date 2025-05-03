import { CourtDivisionDetails } from '../../../../common/src/cams/courts';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { CourtsUseCase } from '../../use-cases/courts/courts';
import { CamsController } from '../controller';

const MODULE_NAME = 'COURTS-CONTROLLER';

export class CourtsController implements CamsController {
  private readonly useCase: CourtsUseCase;

  constructor() {
    this.useCase = new CourtsUseCase();
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<CourtDivisionDetails[]>> {
    try {
      const data = await this.useCase.getCourts(context);
      return httpSuccess({
        body: {
          data,
          meta: {
            self: context.request.url,
          },
        },
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
