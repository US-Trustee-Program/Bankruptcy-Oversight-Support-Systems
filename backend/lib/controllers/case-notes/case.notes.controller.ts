import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import HttpStatusCodes from '@common/api/http-status-codes';
import { CamsController } from '../controller';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { CaseNotesUseCase } from '../../use-cases/case-notes/case-notes';
import {
  CaseNote,
  CaseNoteDeleteRequest,
  CaseNoteEditRequest,
  CaseNoteInput,
  VALID_CASEID_PATTERN,
} from '@common/cams/cases';
import { ForbiddenCaseNotesError } from './case.notes.exception';
import { ResourceActions } from '@common/cams/actions';

const MODULE_NAME = 'CASE-NOTES-CONTROLLER';
const VALID_ID_PATTERN = RegExp(/^[\dA-Za-z]+(-[\dA-Za-z]+)*$/);
const INVALID_ID_MESSAGE = 'case note ID must be provided.';
const INVALID_CASEID_MESSAGE = 'caseId must be formatted like 111-01-12345.';

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
        const noteInput: CaseNoteInput = {
          caseId,
          title,
          content,
        };
        this.validateRequestParameters(noteInput);
        await caseNotesUseCase.createCaseNote(context.session.user, noteInput);
        return httpSuccess({
          statusCode: HttpStatusCodes.CREATED,
        });
      } else if (context.request.method === 'DELETE') {
        const { caseId, noteId } = context.request.params;
        const archiveNote: CaseNoteDeleteRequest = {
          id: noteId,
          caseId,
          sessionUser: context.session.user,
        };
        this.validateArchiveRequestParameters({ id: noteId, caseId });
        await caseNotesUseCase.archiveCaseNote(archiveNote);
        return httpSuccess({
          statusCode: HttpStatusCodes.CREATED,
        });
      } else if (context.request.method === 'PUT') {
        const note = context.request.body;
        const { caseId, noteId } = context.request.params;
        const noteForRequest = {
          ...note,
          id: noteId,
          caseId,
        };
        this.validateRequestParameters(noteForRequest);
        const request: CaseNoteEditRequest = {
          note: noteForRequest,
          sessionUser: context.session.user,
        };

        const newNote = await caseNotesUseCase.editCaseNote(request);
        return httpSuccess({
          statusCode: HttpStatusCodes.CREATED,
          body: {
            data: [newNote],
          },
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

  private validateRequestParameters(input: Partial<CaseNoteInput>) {
    const badParams = [];
    const messages = [];

    if (!input.caseId) {
      badParams.push('caseId');
    } else if (!input.caseId.match(VALID_CASEID_PATTERN)) {
      messages.push(INVALID_CASEID_MESSAGE);
    }

    if (!input.title) {
      badParams.push('case note title');
    }

    if (!input.content) {
      badParams.push('case note content');
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
}
