import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import HttpStatusCodes from '../../../../common/src/api/http-status-codes';
import { CamsController } from '../controller';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { UnknownError } from '../../common-errors/unknown-error';
import { CaseNotesUseCase } from '../../use-cases/case-notes/case-notes';
import { CaseNote } from '../../../../common/src/cams/cases';

const MODULE_NAME = 'CASE-NOTES-CONTROLLER';
const VALID_CASEID_PATTERN = RegExp(/^[\dA-Z]{3}-\d{2}-\d{5}$/);
const INVALID_CASEID_MESSAGE = 'caseId must be formatted like 01-12345.';

export class CaseNotesController implements CamsController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.applicationContext = context;
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit | CamsHttpResponseInit<CaseNote[]>> {
    try {
      const caseNotesUseCase = new CaseNotesUseCase(context);
      if (context.request.method === 'POST') {
        this.validateRequestParameters(context.request.params.caseId);
        const caseId = context.request.params.caseId;
        const note = context.request.body as string;
        await caseNotesUseCase.createCaseNote(context.session.user, caseId, note);
        return httpSuccess({
          statusCode: HttpStatusCodes.CREATED,
        });
      } else {
        const caseNotes = await caseNotesUseCase.getCaseNotes(context.request.params.caseId);
        return httpSuccess({
          body: { data: caseNotes },
          statusCode: HttpStatusCodes.CREATED,
        });
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  private validateRequestParameters(caseId: string) {
    const badParams = [];
    const messages = [];
    if (!caseId) {
      badParams.push('caseId');
    } else if (!caseId.match(VALID_CASEID_PATTERN)) {
      messages.push(INVALID_CASEID_MESSAGE);
    }
    if (badParams.length > 0) {
      const isPlural = badParams.length > 1;
      const message = `Required ${isPlural ? 'parameters' : 'parameter'} ${badParams.join(', ')} ${isPlural ? 'are' : 'is'} absent.`;
      messages.push(message);
    }
    if (messages.length) {
      //TODO: Change this?
      throw new UnknownError(MODULE_NAME, { message: messages.join(' ') });
    }
  }
}
