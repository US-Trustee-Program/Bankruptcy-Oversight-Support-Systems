import { ApplicationContext } from '../../adapters/types/basic';
import { CaseHistoryUseCase } from '../../use-cases/case-history/case-history';
import { CaseHistory } from '@common/cams/history';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';

const MODULE_NAME = 'CASE-HISTORY-CONTROLLER';

export class CaseHistoryController implements CamsController {
  private readonly useCase: CaseHistoryUseCase;

  constructor() {
    this.useCase = new CaseHistoryUseCase();
  }
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<CaseHistory[]>> {
    try {
      const caseHistory = await this.useCase.getCaseHistory(context);
      const success = httpSuccess({
        body: {
          meta: {
            self: context.request.url,
          },
          data: caseHistory,
        },
      });
      return success;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
