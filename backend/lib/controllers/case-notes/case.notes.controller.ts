import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import HttpStatusCodes from '../../../../common/src/api/http-status-codes';
import { CamsController } from '../controller';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { CaseNotesUseCase } from '../../use-cases/case-notes/case-notes';
import { CaseNote } from '../../../../common/src/cams/cases';
import { CaseNotesError } from './case.notes.exception';

const MODULE_NAME = 'CASE-NOTES-CONTROLLER';
const VALID_CASEID_PATTERN = RegExp(/^[\dA-Z]{3}-\d{2}-\d{5}$/);
const INVALID_CASEID_MESSAGE = 'caseId must be formatted like 111-01-12345.';
const MONGO_INJECTED_PATTERN = RegExp(
  /\b(?:db\.[a-zA-Z]+|mongo\.[a-zA-Z]+|(?:find|insert|update|delete|aggregate|create|drop|remove|replace|count|distinct|mapReduce|save)\b\s*(?:\(|{))/i,
);
const JAVASCRIPT_INJECTED_PATTERN = RegExp(
  /\b(?:eval|Function|with|document\.|window\.|alert|prompt|confirm|fetch\s*\(|setTimeout|setInterval)|<script[\s\S]*?>[\s\S]*?<\/script>/i,
);
const INVALID_NOTE_MESSAGE = 'Note content contains invalid keywords.';

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
        const caseId = context.request.params.id;
        const note = context.request.body['note'];
        this.validateRequestParameters(caseId, note);
        await caseNotesUseCase.createCaseNote(context.session.user, caseId, note);
        return httpSuccess({
          statusCode: HttpStatusCodes.CREATED,
        });
      } else {
        const caseNotes = await caseNotesUseCase.getCaseNotes(context.request.params.id);
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

  private validateRequestParameters(caseId: string, note: unknown) {
    const badParams = [];
    const messages = [];
    if (!caseId) {
      badParams.push('caseId');
    } else if (!caseId.match(VALID_CASEID_PATTERN)) {
      messages.push(INVALID_CASEID_MESSAGE);
    } else if (!note) {
      badParams.push('case note');
    } else if ((note as string).match(MONGO_INJECTED_PATTERN)) {
      messages.push(INVALID_NOTE_MESSAGE);
    } else if ((note as string).match(JAVASCRIPT_INJECTED_PATTERN)) {
      messages.push(INVALID_NOTE_MESSAGE);
    }
    if (badParams.length > 0) {
      const isPlural = badParams.length > 1;
      const message = `Required ${isPlural ? 'parameters' : 'parameter'} ${badParams.join(', ')} ${isPlural ? 'are' : 'is'} absent.`;
      messages.push(message);
    }
    if (messages.length) {
      throw new CaseNotesError(MODULE_NAME, { message: messages.join(' ') });
    }
  }
}
