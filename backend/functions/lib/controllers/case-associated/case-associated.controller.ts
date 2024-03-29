import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CamsResponse } from '../controller-types';
import { EventCaseReference } from '../../../../../common/src/cams/events';
import { CaseAssociatedUseCase } from '../../use-cases/case-associated/case-associated';

const MODULE_NAME = 'CASE-ASSOCIATED-CONTROLLER';

type GetCaseAssociatedRequest = {
  caseId: string;
};

type GetCaseAssociatedResponse = CamsResponse<Array<EventCaseReference>>;

export class CaseAssociatedController {
  private readonly useCase: CaseAssociatedUseCase;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = new CaseAssociatedUseCase(applicationContext);
  }

  public async getAssociatedCases(
    context: ApplicationContext,
    request: GetCaseAssociatedRequest,
  ): Promise<GetCaseAssociatedResponse> {
    try {
      const associatedCases = await this.useCase.getAssociatedCases(context, request.caseId);
      return {
        success: true,
        body: associatedCases,
      };
    } catch (originalError) {
      throw originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
