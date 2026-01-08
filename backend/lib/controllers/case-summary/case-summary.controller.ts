import { ApplicationContext } from '../../adapters/types/basic';
import { CaseSummary } from '@common/cams/cases';
import CaseManagement from '../../use-cases/cases/case-management';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';

const MODULE_NAME = 'CASE-SUMMARY-CONTROLLER';

export class CaseSummaryController implements CamsController {
  private readonly useCase: CaseManagement;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = new CaseManagement(applicationContext);
  }
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<CaseSummary>> {
    try {
      const caseSummary = await this.useCase.getCaseSummary(
        context,
        context.request!.params.caseId,
      );
      const success = httpSuccess({
        body: {
          meta: {
            self: context.request!.url,
          },
          data: caseSummary,
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
