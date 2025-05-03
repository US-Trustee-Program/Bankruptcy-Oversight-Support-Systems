import HttpStatusCodes from '../../../../common/src/api/http-status-codes';
import { ResourceActions } from '../../../../common/src/cams/actions';
import {
  CaseNote,
  CaseNoteDeleteRequest,
  CaseNoteEditRequest,
  CaseNoteInput,
} from '../../../../common/src/cams/cases';
import { isValidUserInput } from '../../../../common/src/cams/sanitization';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { CaseNotesUseCase } from '../../use-cases/case-notes/case-notes';
import { CamsController } from '../controller';
import { ForbiddenCaseNotesError } from './case.notes.exception';

const MODULE_NAME = 'CASE-NOTES-CONTROLLER';
const VALID_CASEID_PATTERN = RegExp(/^[\dA-Z]{3}-\d{2}-\d{5}$/);
const VALID_ID_PATTERN = RegExp(/^[\dA-Za-z]+(-[\dA-Za-z]+)*$/);
const INVALID_ID_MESSAGE = 'case note ID must be provided.';
const INVALID_CASEID_MESSAGE = 'caseId must be formatted like 111-01-12345.';
const INVALID_NOTE_MESSAGE = 'Note content contains invalid keywords.';
const INVALID_NOTE_TITLE_MESSAGE = 'Note title contains invalid keywords.';

export class CaseNotesController implements CamsController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.applicationContext = context;
  }

  public async handleRequest(
    context: ApplicationContext<CaseNoteInput>,
  ): Promise<CamsHttpResponseInit | CamsHttpResponseInit<ResourceActions<CaseNote>[]>> {
    try {
      const caseNotesUseCase = new CaseNotesUseCase(context);
      if (context.request.method === 'POST') {
        const { caseId } = context.request.params;
        const { content, title } = context.request.body;
        this.validatePostRequestParameters(caseId, content, title);
        const noteInput: CaseNoteInput = {
          caseId,
          content,
          title,
        };
        await caseNotesUseCase.createCaseNote(context.session.user, noteInput);
        return httpSuccess({
          statusCode: HttpStatusCodes.CREATED,
        });
      } else if (context.request.method === 'DELETE') {
        const { caseId, noteId } = context.request.params;
        const archiveNote: CaseNoteDeleteRequest = {
          caseId,
          id: noteId,
          sessionUser: context.session.user,
        };
        this.validateArchiveRequestParameters(archiveNote);
        await caseNotesUseCase.archiveCaseNote(archiveNote);
        return httpSuccess({
          statusCode: HttpStatusCodes.CREATED,
        });
      } else if (context.request.method === 'PUT') {
        const note = context.request.body;
        const { caseId, noteId } = context.request.params;
        const noteForRequest = {
          ...note,
          caseId,
          id: noteId,
          updatedBy: note.updatedBy,
        };
        const request: CaseNoteEditRequest = {
          note: noteForRequest,
          sessionUser: context.session.user,
        };

        const newNote = await caseNotesUseCase.editCaseNote(request);
        return httpSuccess({
          body: {
            data: [newNote],
          },
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

  private validateArchiveRequestParameters(request: Partial<CaseNoteDeleteRequest>) {
    const badParams = [];
    const messages = [];

    if (!request['id']) {
      badParams.push('id');
    } else if (!request['id'].match(VALID_ID_PATTERN)) {
      messages.push(INVALID_ID_MESSAGE);
    }

    if (!request['caseId']) {
      badParams.push('caseId');
    } else if (!request['caseId'].match(VALID_CASEID_PATTERN)) {
      messages.push(INVALID_CASEID_MESSAGE);
    }

    if (badParams.length > 0) {
      const isPlural = badParams.length > 1;
      const message = `Required ${isPlural ? 'parameters' : 'parameter'} ${badParams.join(', ')} ${isPlural ? 'are' : 'is'} absent.`;
      messages.push(message);
    }
    if (messages.length) {
      throw new ForbiddenCaseNotesError(MODULE_NAME, { message: messages.join(' ') });
    }
  }

  private validatePostRequestParameters(
    caseId: string,
    noteContent: null | string,
    noteTitle: null | string,
  ) {
    const badParams = [];
    const messages = [];
    if (!caseId) {
      badParams.push('caseId');
    } else if (!caseId.match(VALID_CASEID_PATTERN)) {
      messages.push(INVALID_CASEID_MESSAGE);
    }

    if (!noteTitle) {
      badParams.push('case note title');
    } else if (!isValidUserInput(noteTitle)) {
      messages.push(INVALID_NOTE_TITLE_MESSAGE);
    }

    if (!noteContent) {
      badParams.push('case note content');
    } else if (!isValidUserInput(noteContent)) {
      messages.push(INVALID_NOTE_MESSAGE);
    }

    if (badParams.length > 0) {
      const isPlural = badParams.length > 1;
      const message = `Required ${isPlural ? 'parameters' : 'parameter'} ${badParams.join(', ')} ${isPlural ? 'are' : 'is'} absent.`;
      messages.push(message);
    }
    if (messages.length) {
      throw new ForbiddenCaseNotesError(MODULE_NAME, { message: messages.join(' ') });
    }
  }
}
