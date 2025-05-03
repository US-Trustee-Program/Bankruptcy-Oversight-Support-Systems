import { EventCaseReference } from '../../../../common/src/cams/events';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { CaseAssociatedUseCase } from '../../use-cases/case-associated/case-associated';

const MODULE_NAME = 'CASE-ASSOCIATED-CONTROLLER';

export class CaseAssociatedController {
  private readonly useCase: CaseAssociatedUseCase;

  constructor() {
    this.useCase = new CaseAssociatedUseCase();
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<EventCaseReference[]>> {
    try {
      const associatedCases = await this.useCase.getAssociatedCases(context);
      return httpSuccess({
        body: { data: associatedCases },
      });
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
