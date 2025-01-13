import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import HttpStatusCodes from '../../../../common/src/api/http-status-codes';
import { CamsController } from '../controller';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { CaseNotesUseCase } from '../../use-cases/case-notes/case-notes';
import { CaseNote, CaseNoteInput } from '../../../../common/src/cams/cases';
import { CaseNotesForbidden } from './case.notes.exception';
import { isValidUserInput } from '../../../../common/src/cams/sanitization';

const MODULE_NAME = 'CASE-NOTES-CONTROLLER';
const VALID_CASEID_PATTERN = RegExp(/^[\dA-Z]{3}-\d{2}-\d{5}$/);
const INVALID_CASEID_MESSAGE = 'caseId must be formatted like 111-01-12345.';
const INVALID_NOTE_MESSAGE = 'Note content contains invalid keywords.';
const INVALID_NOTE_TITLE_MESSAGE = 'Note title contains invalid keywords.';

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
        const noteContent = context.request.body['content'];
        const noteTitle = context.request.body['title'];
        this.validateRequestParameters(caseId, noteContent, noteTitle);
        const noteInput: CaseNoteInput = {
          caseId,
          title: noteTitle,
          content: noteContent,
        };
        await caseNotesUseCase.createCaseNote(context.session.user, noteInput);
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

  private validateRequestParameters(caseId: string, noteContent: unknown, noteTitle: unknown) {
    const badParams = [];
    const messages = [];
    if (!caseId) {
      badParams.push('caseId');
    } else if (!caseId.match(VALID_CASEID_PATTERN)) {
      messages.push(INVALID_CASEID_MESSAGE);
    }

    if (!noteTitle) {
      badParams.push('case note title');
    } else if (!isValidUserInput(noteTitle as string)) {
      messages.push(INVALID_NOTE_TITLE_MESSAGE);
    }

    if (!noteContent) {
      badParams.push('case note content');
    } else if (!isValidUserInput(noteContent as string)) {
      messages.push(INVALID_NOTE_MESSAGE);
    }

    if (badParams.length > 0) {
      const isPlural = badParams.length > 1;
      const message = `Required ${isPlural ? 'parameters' : 'parameter'} ${badParams.join(', ')} ${isPlural ? 'are' : 'is'} absent.`;
      messages.push(message);
    }
    if (messages.length) {
      throw new CaseNotesForbidden(MODULE_NAME, { message: messages.join(' ') });
    }
  }
}
