import { ApplicationContext } from '../../adapters/types/basic';
import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { EventCaseReference } from '../../../../../common/src/cams/events';
import { CaseAssociatedUseCase } from '../../use-cases/case-associated/case-associated';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { closeDeferred } from '../../defer-close';

const MODULE_NAME = 'CASE-ASSOCIATED-CONTROLLER';

export class CaseAssociatedController {
  private readonly useCase: CaseAssociatedUseCase;

  constructor(_applicationContext: ApplicationContext) {
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
      await closeDeferred(context);
    }
  }
}
